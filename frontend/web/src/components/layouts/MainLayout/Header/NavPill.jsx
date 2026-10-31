import './NavPill.css';
import ChevronLeft from '../../../../assets/icons/ChevronLeft';
import ChevronRight from '../../../../assets/icons/ChevronRight';
import NavDivider from '../../../../assets/icons/NavDivider';
import useNavigationHistory from '../../../../hooks/useNavigationHistory';

function NavPill() {
  const { canGoBack, canGoForward, goBack, goForward } = useNavigationHistory();

  return (
    <div className="header-nav-pill">
      <button
        type="button"
        className={`header-nav-square ${canGoBack ? 'header-nav-square--enabled' : 'header-nav-square--disabled'}`}
        onClick={goBack}
        disabled={!canGoBack}
        aria-label="Lùi lại"
        title={canGoBack ? 'Lùi lại' : undefined}
      >
        <ChevronLeft />
      </button>
      <NavDivider className="header-nav-divider" />
      <button
        type="button"
        className={`header-nav-square ${canGoForward ? 'header-nav-square--enabled' : 'header-nav-square--disabled'}`}
        onClick={goForward}
        disabled={!canGoForward}
        aria-label="Tiến tới"
        title={canGoForward ? 'Tiến tới' : undefined}
      >
        <ChevronRight />
      </button>
    </div>
  );
}

export default NavPill;
