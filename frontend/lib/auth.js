export const auth = {
  login: (token, username, role) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      localStorage.setItem('role', role);
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.href = '/login';
    }
  },

  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  },

  getUser: () => {
    if (typeof window !== 'undefined') {
      return {
        username: localStorage.getItem('username'),
        role: localStorage.getItem('role'),
      };
    }
    return { username: null, role: null };
  },

  isAuthenticated: () => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('token');
    }
    return false;
  },
};

export default auth;
