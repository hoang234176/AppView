import './FilterButton.css';
import FilterIcon from '../../../../assets/icons/FilterIcon';

function FilterButton() {
  return (
    <button type="button" className="header-filter-btn" aria-label="Lọc">
      <FilterIcon />
    </button>
  );
}

export default FilterButton;
