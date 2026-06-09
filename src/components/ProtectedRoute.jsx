import { Outlet } from 'react-router-dom';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function ProtectedRoute({ unauthenticatedElement }) {
  const { localUser } = useLocalUser();

  if (!localUser) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}