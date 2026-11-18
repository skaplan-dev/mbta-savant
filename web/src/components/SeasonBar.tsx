import DateBox from './DateBox';
import SeasonToggle from './SeasonToggle';

/** The date box and season toggle row atop the car and line pages; `className` sets margins. */
export default function SeasonBar({
    latest,
    options,
    value,
    className,
}: {
    latest: string | null;
    options: string[];
    value: string;
    className: string;
}) {
    return (
        <div
            className={`flex flex-col justify-between gap-4 md:flex-row md:items-stretch ${className}`}
        >
            <DateBox latest={latest} />
            <SeasonToggle options={options} value={value} />
        </div>
    );
}
