import useLayout from '../../../../hooks/useLayout';
import MoreButton from './MoreButton';
import DownloadButton from './DownloadButton';
import SearchPill from './SearchPill';

function HeaderRight() {
  const { isHeaderRightExiting } = useLayout();

  return (
    <div className={`header-right-zone ${isHeaderRightExiting ? 'header-right-zone--exiting' : ''}`}>
      <MoreButton />
      <DownloadButton />
      <SearchPill />
    </div>
  );
}

export default HeaderRight;
