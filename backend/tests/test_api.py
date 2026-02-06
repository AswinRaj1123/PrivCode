# backend/tests/test_api.py
"""
API Tests for PrivCode Backend
Tests authentication, authorization, and basic endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

# =====================================================
# HEALTH CHECK TESTS
# =====================================================

def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"


# =====================================================
# AUTHENTICATION TESTS
# =====================================================

def test_login_success():
    """Test successful login with valid credentials."""
    response = client.post(
        "/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    data = response.json()
    
    # Check response structure
    assert "token" in data
    assert "username" in data
    assert "role" in data
    
    # Check values
    assert data["username"] == "admin"
    assert data["role"] == "admin"
    assert isinstance(data["token"], str)
    assert len(data["token"]) > 10


def test_login_invalid_credentials():
    """Test login with invalid credentials."""
    response = client.post(
        "/login",
        json={"username": "admin", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data


def test_login_nonexistent_user():
    """Test login with non-existent user."""
    response = client.post(
        "/login",
        json={"username": "nonexistent", "password": "password"}
    )
    assert response.status_code == 401


# =====================================================
# AUTHORIZATION TESTS
# =====================================================

def test_query_without_token():
    """Test query endpoint without authentication."""
    response = client.post(
        "/query",
        json={"question": "test"}
    )
    # Should require authorization header
    assert response.status_code in (401, 403)


def test_query_with_invalid_token():
    """Test query with invalid/expired token."""
    response = client.post(
        "/query",
        json={"question": "test"},
        headers={"Authorization": "Bearer invalid_token_here"}
    )
    assert response.status_code in (401, 403)


def test_authenticated_user_info():
    """Test getting authenticated user info."""
    # First login
    login_response = client.post(
        "/login",
        json={"username": "viewer", "password": "viewer123"}
    )
    assert login_response.status_code == 200
    token = login_response.json()["token"]
    
    # Then get user info
    response = client.get(
        "/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "viewer"
    assert data["role"] == "viewer"


# =====================================================
# ROLE-BASED ACCESS TESTS
# =====================================================

def test_viewer_login():
    """Test viewer user login."""
    response = client.post(
        "/login",
        json={"username": "viewer", "password": "viewer123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "viewer"


def test_admin_login():
    """Test admin user login."""
    response = client.post(
        "/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin"


# =====================================================
# INTEGRATION TESTS
# =====================================================

def test_login_and_get_me():
    """Test complete login flow."""
    # Login
    login_resp = client.post(
        "/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["token"]
    
    # Get user info
    me_resp = client.get(
        "/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_resp.status_code == 200
    user = me_resp.json()
    assert user["username"] == "admin"
    assert user["role"] == "admin"


# =====================================================
# RUN TESTS
# =====================================================
# Run with: pytest backend/tests/test_api.py -v
# Run with coverage: pytest backend/tests/test_api.py --cov=backend --cov-report=html
