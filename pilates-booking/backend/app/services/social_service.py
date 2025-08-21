from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ..models import Booking, ClassInstance, ClassInvitation, Friendship, User
from ..models.friendship import FriendshipStatus


class SocialService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def send_friend_request(self, requester_id: int, friend_id: int) -> Dict:
        """Send a friend request."""
        if requester_id == friend_id:
            return {"error": "Cannot send friend request to yourself"}

        # Check if friendship already exists
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.user_id == requester_id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == requester_id)
            )
        )
        existing_friendship = (await self.db.execute(stmt)).scalar_one_or_none()
        
        if existing_friendship:
            if existing_friendship.status == FriendshipStatus.BLOCKED:
                return {"error": "Cannot send friend request to blocked user"}
            elif existing_friendship.status == FriendshipStatus.PENDING:
                return {"error": "Friend request already pending"}
            elif existing_friendship.status == FriendshipStatus.ACCEPTED:
                return {"error": "Already friends"}

        # Create friend request
        friendship = Friendship(
            user_id=requester_id,
            friend_id=friend_id,
            status=FriendshipStatus.PENDING
        )
        self.db.add(friendship)
        await self.db.commit()
        await self.db.refresh(friendship)

        return {"success": True, "friendship_id": friendship.id}

    async def accept_friend_request(self, recipient_id: int, requester_id: int) -> Dict:
        """Accept a friend request."""
        stmt = select(Friendship).where(
            and_(
                Friendship.user_id == requester_id,
                Friendship.friend_id == recipient_id,
                Friendship.status == FriendshipStatus.PENDING
            )
        )
        friendship = (await self.db.execute(stmt)).scalar_one_or_none()
        
        if not friendship:
            return {"error": "Friend request not found"}

        friendship.status = FriendshipStatus.ACCEPTED
        friendship.accepted_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        return {"success": True}

    async def reject_friend_request(self, recipient_id: int, requester_id: int) -> Dict:
        """Reject/remove a friend request."""
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.user_id == requester_id, Friendship.friend_id == recipient_id),
                and_(Friendship.user_id == recipient_id, Friendship.friend_id == requester_id)
            )
        )
        friendship = (await self.db.execute(stmt)).scalar_one_or_none()
        
        if not friendship:
            return {"error": "Friendship not found"}

        await self.db.delete(friendship)
        await self.db.commit()
        return {"success": True}

    async def block_user(self, blocker_id: int, blocked_id: int) -> Dict:
        """Block a user."""
        if blocker_id == blocked_id:
            return {"error": "Cannot block yourself"}

        # Remove any existing friendship
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.user_id == blocker_id, Friendship.friend_id == blocked_id),
                and_(Friendship.user_id == blocked_id, Friendship.friend_id == blocker_id)
            )
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        
        if existing:
            await self.db.delete(existing)

        # Create block relationship
        block = Friendship(
            user_id=blocker_id,
            friend_id=blocked_id,
            status=FriendshipStatus.BLOCKED
        )
        self.db.add(block)
        await self.db.commit()

        return {"success": True}

    async def get_friends(self, user_id: int) -> List[Dict]:
        """Get list of friends for a user."""
        stmt = select(Friendship).options(
            selectinload(Friendship.requester),
            selectinload(Friendship.friend)
        ).where(
            and_(
                or_(
                    Friendship.user_id == user_id,
                    Friendship.friend_id == user_id
                ),
                Friendship.status == FriendshipStatus.ACCEPTED
            )
        )
        friendships = (await self.db.execute(stmt)).scalars().all()

        friends = []
        for friendship in friendships:
            friend = friendship.friend if friendship.user_id == user_id else friendship.requester
            friends.append({
                "id": friend.id,
                "first_name": friend.first_name,
                "last_name": friend.last_name,
                "avatar_url": friend.avatar_url,
                "email": friend.email,
                "friendship_since": friendship.accepted_at
            })

        return friends

    async def get_pending_friend_requests(self, user_id: int) -> Dict:
        """Get pending friend requests (sent and received)."""
        # Received requests
        received_stmt = select(Friendship).options(
            selectinload(Friendship.requester)
        ).where(
            and_(
                Friendship.friend_id == user_id,
                Friendship.status == FriendshipStatus.PENDING
            )
        )
        received_requests = (await self.db.execute(received_stmt)).scalars().all()

        # Sent requests
        sent_stmt = select(Friendship).options(
            selectinload(Friendship.friend)
        ).where(
            and_(
                Friendship.user_id == user_id,
                Friendship.status == FriendshipStatus.PENDING
            )
        )
        sent_requests = (await self.db.execute(sent_stmt)).scalars().all()

        return {
            "received": [
                {
                    "id": req.requester.id,
                    "first_name": req.requester.first_name,
                    "last_name": req.requester.last_name,
                    "avatar_url": req.requester.avatar_url,
                    "requested_at": req.requested_at
                }
                for req in received_requests
            ],
            "sent": [
                {
                    "id": req.friend.id,
                    "first_name": req.friend.first_name,
                    "last_name": req.friend.last_name,
                    "avatar_url": req.friend.avatar_url,
                    "requested_at": req.requested_at
                }
                for req in sent_requests
            ]
        }

    async def get_class_attendees(self, class_id: int, viewer_id: int) -> List[Dict]:
        """Get list of class attendees with privacy filtering."""
        stmt = select(Booking).options(
            selectinload(Booking.user)
        ).where(
            and_(
                Booking.class_instance_id == class_id,
                Booking.status == "confirmed"
            )
        )
        bookings = (await self.db.execute(stmt)).scalars().all()

        attendees = []
        for booking in bookings:
            user = booking.user
            privacy_settings = user.privacy_settings or {}
            
            # Check if user allows being shown in attendee lists
            if not privacy_settings.get("show_in_attendees", True):
                # Only show to friends
                if not await self.are_friends(viewer_id, user.id):
                    continue

            attendees.append({
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "avatar_url": user.avatar_url,
                "booking_date": booking.booking_date,
                "is_you": user.id == viewer_id
            })

        return attendees

    async def are_friends(self, user_id: int, other_user_id: int) -> bool:
        """Check if two users are friends."""
        stmt = select(Friendship).where(
            and_(
                or_(
                    and_(Friendship.user_id == user_id, Friendship.friend_id == other_user_id),
                    and_(Friendship.user_id == other_user_id, Friendship.friend_id == user_id)
                ),
                Friendship.status == FriendshipStatus.ACCEPTED
            )
        )
        friendship = (await self.db.execute(stmt)).scalar_one_or_none()
        return friendship is not None

    async def invite_to_class(self, sender_id: int, recipient_id: int, class_id: int) -> Dict:
        """Send a class invitation to a friend."""
        # Check if they are friends
        if not await self.are_friends(sender_id, recipient_id):
            return {"error": "Can only invite friends to classes"}

        # Check if invitation already exists
        stmt = select(ClassInvitation).where(
            and_(
                ClassInvitation.sender_id == sender_id,
                ClassInvitation.recipient_id == recipient_id,
                ClassInvitation.class_instance_id == class_id
            )
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        
        if existing:
            return {"error": "Invitation already sent"}

        invitation = ClassInvitation(
            sender_id=sender_id,
            recipient_id=recipient_id,
            class_instance_id=class_id
        )
        self.db.add(invitation)
        await self.db.commit()

        return {"success": True, "invitation_id": invitation.id}

    async def get_mutual_classes(self, user_id: int, friend_id: int, limit: int = 10) -> List[Dict]:
        """Get classes both users have attended together."""
        stmt = select(ClassInstance).options(
            selectinload(ClassInstance.template),
            selectinload(ClassInstance.instructor)
        ).join(
            Booking, ClassInstance.id == Booking.class_instance_id
        ).where(
            and_(
                Booking.user_id.in_([user_id, friend_id]),
                Booking.status == "completed"
            )
        ).group_by(ClassInstance.id).having(
            select().where(
                and_(
                    Booking.class_instance_id == ClassInstance.id,
                    Booking.user_id.in_([user_id, friend_id]),
                    Booking.status == "completed"
                )
            ).func.count() == 2
        ).limit(limit)

        classes = (await self.db.execute(stmt)).scalars().all()
        
        return [
            {
                "id": cls.id,
                "name": cls.template.name,
                "date": cls.start_datetime,
                "instructor_name": cls.instructor.full_name
            }
            for cls in classes
        ]

    async def get_friends_in_class(self, user_id: int, class_id: int) -> List[Dict]:
        """Get friends who are also attending a specific class."""
        # Get user's friends
        friends = await self.get_friends(user_id)
        friend_ids = [f["id"] for f in friends]

        if not friend_ids:
            return []

        # Get friends' bookings for this class
        stmt = select(Booking).options(
            selectinload(Booking.user)
        ).where(
            and_(
                Booking.class_instance_id == class_id,
                Booking.user_id.in_(friend_ids),
                Booking.status == "confirmed"
            )
        )
        bookings = (await self.db.execute(stmt)).scalars().all()

        return [
            {
                "id": booking.user.id,
                "first_name": booking.user.first_name,
                "last_name": booking.user.last_name,
                "avatar_url": booking.user.avatar_url
            }
            for booking in bookings
        ]