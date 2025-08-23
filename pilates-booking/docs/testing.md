# Testing Guide

Essential testing information for the Pilates Booking System.

## Quick Commands

### Backend Testing
```bash
make test-backend              # All backend tests
cd backend && python -m pytest --cov=app --cov-report=html  # With coverage
cd backend && python -m pytest tests/unit/test_auth.py -v   # Specific test
```

### Mobile Testing
```bash
cd mobile && npm test          # All mobile tests
cd mobile && npm test -- --coverage  # With coverage
cd mobile && npm test -- --watch     # Watch mode
```

## Test Structure

```
backend/tests/
├── unit/           # Fast, isolated tests
├── integration/    # API endpoint tests
└── conftest.py     # Shared fixtures

mobile/tests/
├── unit/          # Component and hook tests
├── integration/   # Screen flow tests
└── setup.ts       # Jest configuration
```

## Writing Tests

### Backend Example
```python
@pytest.mark.unit
async def test_create_user_success(self, db_session):
    # Arrange
    user_data = UserFactory.build()
    
    # Act
    user = await user_service.create_user(user_data)
    
    # Assert
    assert user.email == user_data.email
```

### Mobile Example
```typescript
describe('LoginButton', () => {
  it('should disable when loading', () => {
    const { getByRole } = render(<LoginButton isLoading={true} />);
    expect(getByRole('button')).toBeDisabled();
  });
});
```

## Coverage Requirements

- **Backend**: 80% minimum
- **Mobile**: 75% minimum
- **Critical paths**: 100% (auth, payment, booking)

## Best Practices

- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)  
- Mock external dependencies
- Keep tests isolated and fast
- Test both success and error cases