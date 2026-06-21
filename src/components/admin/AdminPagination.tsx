import Link from "next/link";

type SearchParamValue = string | number | undefined;

type AdminPaginationProps = {
    page: number;
    pageSize: number;
    total: number;
    params?: Record<string, SearchParamValue>;
};

function buildPageHref(params: Record<string, SearchParamValue>, page: number) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "") continue;
        query.set(key, String(value));
    }

    query.set("page", String(page));
    return `?${query.toString()}`;
}

export function AdminPagination({ page, pageSize, total, params = {} }: AdminPaginationProps) {
    const totalPages = Math.ceil(total / pageSize);

    if (totalPages <= 1) return null;

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/50">
                Page <span className="font-medium text-white">{page}</span> of{" "}
                <span className="font-medium text-white">{totalPages}</span>
                <span className="ml-2 text-white/30">({total.toLocaleString()} total)</span>
            </p>
            <div className="flex gap-2">
                {page > 1 && (
                    <Link
                        href={buildPageHref(params, page - 1)}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
                    >
                        Previous
                    </Link>
                )}
                {page < totalPages && (
                    <Link
                        href={buildPageHref(params, page + 1)}
                        className="rounded-xl bg-[#FFC931] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#FFD966]"
                    >
                        Next
                    </Link>
                )}
            </div>
        </div>
    );
}
