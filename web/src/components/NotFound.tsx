import { Link } from '@tanstack/react-router';

export default function NotFound() {
    return (
        <div className="py-20 text-center">
            <h1 className="m-0 text-[46px] font-medium tracking-tight">Not found</h1>
            <p className="text-ink-2 mt-3 text-[21px]">
                We couldn&rsquo;t find that page. Try a car number in the search box, or head back{' '}
                <Link to="/" className="text-brand">
                    home
                </Link>
                .
            </p>
        </div>
    );
}
