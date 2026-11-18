/** "11/16 | Stats through last night's service · updated nightly" */
export default function DateBox({ latest }: { latest: string | null | undefined }) {
    const [, m, d] = (latest ?? '').split('-').map(Number);

    return (
        <div className="border-panel-line rounded-panel flex flex-wrap overflow-hidden border">
            <div className="border-panel-line flex items-center border-r px-[18px] py-3.5 text-[26px] md:text-[34px]">
                {m && d ? `${m}/${d}` : '–'}
            </div>
            <div className="text-ink flex items-center px-3.5 py-2.5 text-lg md:px-[26px] md:py-0 md:text-[21px]">
                Stats through last night&rsquo;s service &middot; updated nightly
            </div>
        </div>
    );
}
