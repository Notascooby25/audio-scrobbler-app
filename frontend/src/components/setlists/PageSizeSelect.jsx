import { PAGE_SIZES } from "./useListPaging";

export default function PageSizeSelect({ id, noun, value, onChange }) {
  return (
    <label htmlFor={id} className="sfm-page-size">
      {noun.charAt(0).toUpperCase() + noun.slice(1)} shown per page
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
