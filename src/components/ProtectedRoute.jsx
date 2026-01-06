import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, isAllowed, redirectTo = "/login" }) => {
  if (!isAllowed) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
};

export default ProtectedRoute;