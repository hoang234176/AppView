import './NavPill.css';
import ChevronLeft from '../../../../assets/icons/ChevronLeft';
import ChevronRight from '../../../../assets/icons/ChevronRight';
import NavDivider from '../../../../assets/icons/NavDivider';

function NavPill() {
  return (
    <div className="header-nav-pill">
      <button type="button" className="header-nav-square" aria-label="Lùi">
        <ChevronLeft />
      </button>
      <NavDivider className="header-nav-divider" />
      <button type="button" className="header-nav-square" aria-label="Tiến">
        <ChevronRight />
      </button>
    </div>
  );
}

export default NavPill;
