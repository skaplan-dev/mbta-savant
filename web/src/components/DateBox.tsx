export default function DateBox({ latest }: { latest: string | null }) {
    const date = latest
        ? new Date(`${latest}T00:00:00Z`).toLocaleDateString('en-US', {
              month: 'numeric',
              day: 'numeric',
              timeZone: 'UTC',
          })
        : '–';

    return (
        <div className="border-panel-line rounded-panel flex flex-col overflow-hidden border min-[430px]:flex-row">
            <div className="border-panel-line text-subsection md:text-section flex items-center border-b px-[18px] py-3.5 min-[430px]:border-r min-[430px]:border-b-0">
                {date}
            </div>
            <div className="text-ink text-ui md:text-lead flex items-center px-3.5 py-2.5 md:px-[26px] md:py-0">
                Stats through last night&rsquo;s service &middot; updated nightly
            </div>
        </div>
    );
}
