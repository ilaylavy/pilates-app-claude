"""
Mock email service for testing email functionality.
"""

from typing import Dict, List, Optional, Any
from unittest.mock import MagicMock


class MockEmailService:
    """Mock implementation of email service for testing."""
    
    def __init__(self):
        self.sent_emails: List[Dict[str, Any]] = []
        self.email_templates = {}
        self._should_fail = False
        self._failure_reason = None
    
    def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> bool:
        """Mock email sending."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Email sending failed")
        
        email = {
            "to": to,
            "subject": subject,
            "html_content": html_content,
            "text_content": text_content,
            "from_email": from_email or "noreply@pilatesbooking.com",
            "reply_to": reply_to,
            "sent_at": "2024-01-01T10:00:00Z"
        }
        
        self.sent_emails.append(email)
        return True
    
    def send_verification_email(self, to: str, verification_token: str) -> bool:
        """Mock verification email sending."""
        return self.send_email(
            to=to,
            subject="Verify Your Email - Pilates Booking",
            html_content=f"""
            <h1>Verify Your Email</h1>
            <p>Please click the link below to verify your email:</p>
            <a href="http://localhost:3000/verify-email?token={verification_token}">
                Verify Email
            </a>
            """,
            text_content=f"Verify your email: http://localhost:3000/verify-email?token={verification_token}"
        )
    
    def send_password_reset_email(self, to: str, reset_token: str) -> bool:
        """Mock password reset email sending."""
        return self.send_email(
            to=to,
            subject="Reset Your Password - Pilates Booking",
            html_content=f"""
            <h1>Reset Your Password</h1>
            <p>Please click the link below to reset your password:</p>
            <a href="http://localhost:3000/reset-password?token={reset_token}">
                Reset Password
            </a>
            <p>This link expires in 1 hour.</p>
            """,
            text_content=f"Reset your password: http://localhost:3000/reset-password?token={reset_token}"
        )
    
    def send_booking_confirmation(
        self,
        to: str,
        user_name: str,
        class_name: str,
        class_date: str,
        instructor_name: str
    ) -> bool:
        """Mock booking confirmation email."""
        return self.send_email(
            to=to,
            subject=f"Booking Confirmed: {class_name}",
            html_content=f"""
            <h1>Booking Confirmed</h1>
            <p>Hi {user_name},</p>
            <p>Your booking has been confirmed:</p>
            <ul>
                <li>Class: {class_name}</li>
                <li>Date: {class_date}</li>
                <li>Instructor: {instructor_name}</li>
            </ul>
            <p>We look forward to seeing you!</p>
            """,
            text_content=f"Booking confirmed for {class_name} on {class_date} with {instructor_name}"
        )
    
    def send_booking_cancellation(
        self,
        to: str,
        user_name: str,
        class_name: str,
        class_date: str,
        refund_amount: Optional[str] = None
    ) -> bool:
        """Mock booking cancellation email."""
        refund_text = f"<p>Refund of {refund_amount} has been processed.</p>" if refund_amount else ""
        
        return self.send_email(
            to=to,
            subject=f"Booking Cancelled: {class_name}",
            html_content=f"""
            <h1>Booking Cancelled</h1>
            <p>Hi {user_name},</p>
            <p>Your booking for {class_name} on {class_date} has been cancelled.</p>
            {refund_text}
            <p>We hope to see you in a future class!</p>
            """,
            text_content=f"Booking cancelled for {class_name} on {class_date}"
        )
    
    def send_waitlist_promotion(
        self,
        to: str,
        user_name: str,
        class_name: str,
        class_date: str
    ) -> bool:
        """Mock waitlist promotion email."""
        return self.send_email(
            to=to,
            subject=f"Spot Available: {class_name}",
            html_content=f"""
            <h1>A Spot Opened Up!</h1>
            <p>Hi {user_name},</p>
            <p>Great news! A spot has opened up in:</p>
            <ul>
                <li>Class: {class_name}</li>
                <li>Date: {class_date}</li>
            </ul>
            <p>Your waitlist entry has been automatically converted to a confirmed booking.</p>
            """,
            text_content=f"Spot available in {class_name} on {class_date} - you're now booked!"
        )
    
    def send_class_reminder(
        self,
        to: str,
        user_name: str,
        class_name: str,
        class_date: str,
        location: str = "Studio"
    ) -> bool:
        """Mock class reminder email."""
        return self.send_email(
            to=to,
            subject=f"Class Reminder: {class_name} Tomorrow",
            html_content=f"""
            <h1>Class Reminder</h1>
            <p>Hi {user_name},</p>
            <p>This is a friendly reminder about your upcoming class:</p>
            <ul>
                <li>Class: {class_name}</li>
                <li>Date: {class_date}</li>
                <li>Location: {location}</li>
            </ul>
            <p>Please arrive 10 minutes early. See you there!</p>
            """,
            text_content=f"Reminder: {class_name} on {class_date} at {location}"
        )
    
    def get_sent_emails(self, to: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of sent emails, optionally filtered by recipient."""
        if to:
            return [email for email in self.sent_emails if email["to"] == to]
        return self.sent_emails.copy()
    
    def clear_sent_emails(self):
        """Clear the list of sent emails."""
        self.sent_emails.clear()
    
    def set_failure_mode(self, should_fail: bool, reason: Optional[str] = None):
        """Set the mock to simulate email sending failures."""
        self._should_fail = should_fail
        self._failure_reason = reason
    
    def get_last_email(self) -> Optional[Dict[str, Any]]:
        """Get the last sent email."""
        return self.sent_emails[-1] if self.sent_emails else None
    
    def get_emails_count(self) -> int:
        """Get the count of sent emails."""
        return len(self.sent_emails)


def get_mock_email_service() -> MockEmailService:
    """Get a configured mock email service."""
    return MockEmailService()