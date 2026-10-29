import { useSearchParams } from "react-router-dom";

export const PAGE_SIZES = [10, 15, 25, 50];
export const DEFAULT_PAGE_SIZE = 15;

/**
 * Page and page size for a Set Lists list, kept in the URL (?page=, ?size=) so the
 * browser Back button returns to the same page. Paging replaces the history entry.
 */
export default function useListPaging(itemCount) {
  const [searchParams, setSearchParams] = useSearchParams();

  const sizeParam = Number(searchParams.get("size"));
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(itemCount / pageSize));
  const pageParam = Number(searchParams.get("page"));
  const currentPage =
    Number.isInteger(pageParam) && pageParam >= 1 ? Math.min(pageParam, totalPages) : 1;

  const updateParams = (changes) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined) params.delete(key);
      else params.set(key, String(value));
    });
    setSearchParams(params, { replace: true });
  };

  return {
    searchParams,
    pageSize,
    currentPage,
    totalPages,
    updateParams,
    pageSlice: (items) => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  };
}
