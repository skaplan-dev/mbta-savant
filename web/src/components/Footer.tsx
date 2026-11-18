export default function Footer() {
    return (
        <footer className="border-panel-line text-ink-2 text-ui mt-10 flex flex-wrap justify-between gap-5 border-t pt-[18px] pb-10">
            <span>
                A TransitMatters Labs fan site, not an official MBTA assessment. Built nightly from
                MBTA arrival and departure data.
            </span>
            <span>Vehicle data: The MBTA Vehicle Inventory Page (unofficial)</span>
        </footer>
    );
}
