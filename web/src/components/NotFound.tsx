import { Link } from '@tanstack/react-router';
import { NOT_FOUND_TITLE } from '../titles';
import Search from './Search';
import { useDocumentTitle } from './useDocumentTitle';

export default function NotFound() {
    useDocumentTitle(NOT_FOUND_TITLE);
    return (
        <main className="py-16 text-center md:py-20">
            <h1 className="m-0 text-[38px] font-medium tracking-tight md:text-[46px]">
                Nothing here
            </h1>
            <p className="text-ink-2 mx-auto mt-3 mb-7 max-w-[52ch] text-xl md:text-[21px]">
                We couldn&rsquo;t find that page or car. Try a car or bus number below, or head back{' '}
                <Link to="/" className="text-brand">
                    home
                </Link>
                .
            </p>
            <div className="mx-auto max-w-[520px] text-left">
                <Search label="Search for a car or bus number" />
            </div>
        </main>
    );
}
