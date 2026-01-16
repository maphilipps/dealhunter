import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    role: 'bd' | 'bl' | 'admin';
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'bd' | 'bl' | 'admin';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'bd' | 'bl' | 'admin';
  }
}
