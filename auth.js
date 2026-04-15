// ============================================
// ./auth.js
// ============================================

export const Auth = {
  async authenticate(t) {
    try {
      const member = await t.member('id', 'fullName', 'username');
      if (!member || !member.id) {
        throw new Error('Could not get Trello member info');
      }
      return member;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  },

  async getCurrentUser(t) {
    try {
      const member = await t.member('id', 'fullName', 'username');
      return member || null;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }
};

export default Auth;