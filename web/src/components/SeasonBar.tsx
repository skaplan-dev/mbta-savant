import DateBox from './DateBox';
import SeasonToggle from './SeasonToggle';

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
            className={`flex flex-col justify-between gap-4 min-[1024px]:flex-row min-[1024px]:items-stretch ${className}`}
        >
            <DateBox latest={latest} />
            <SeasonToggle options={options} value={value} />
        </div>
    );
}
