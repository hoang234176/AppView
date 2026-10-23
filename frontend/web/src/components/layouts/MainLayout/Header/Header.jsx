import './Header.css';
import { useLocation } from 'react-router-dom';
import useLayout from '../../../../hooks/useLayout';
import HeaderLeft from './HeaderLeft';
import HeaderRight from './HeaderRight';

function Header() {
  const { isHeaderRightVisible } = useLayout();
  const location = useLocation();
  const isSettings = location.pathname === '/settings';

  return (
    <header className="main-header">
      <HeaderLeft />
      {!isSettings && isHeaderRightVisible && <HeaderRight />}
    </header>
  );
}

export default Header;
