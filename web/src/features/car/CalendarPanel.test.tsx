import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { car } from '../../test/fixtures';
import CalendarPanel from './CalendarPanel';

afterEach(cleanup);

const RAN = { date: '2026-03-02', trips: 20, miles: 100, trip_time_sec: 84, routes: ['Red'] };

function setup() {
    return render(
        <CalendarPanel
            season="2026"
            car={car('1902', { game_log: [RAN] })}
            typical={100}
            segs={1}
            window={{ key: '2026', start: '2026-01-01', end: '2026-12-31' }}
            latest="2026-03-31"
        />
    );
}

// A day's cell is the SVG rect whose <title> is the hover text.
const cell = (date: string) => {
    const rect = screen.getByText(new RegExp(`^${date} `)).parentElement;

    if (!rect) throw new Error(`no calendar cell for ${date}`);

    return rect;
};

describe('CalendarPanel day readout', () => {
    it('tells touch users how to read a day, since hover titles do not work for them', () => {
        setup();

        expect(screen.getByRole('status').textContent).toMatch(/select a day/i);
    });
    it("shows a day's trips and time saved when it is tapped", () => {
        setup();
        fireEvent.click(cell('2026-03-02'));

        expect(screen.getByRole('status').textContent).toBe(
            '2026-03-02 · 20 trips · +16 s saved per trip'
        );
    });
    it('says when a tapped day did not run, and follows the latest tap', () => {
        setup();
        fireEvent.click(cell('2026-03-02'));
        fireEvent.click(cell('2026-03-03'));

        expect(screen.getByRole('status').textContent).toBe('2026-03-03 · did not run');
    });
    it('points keyboard users at the game log, which lists every day', () => {
        setup();

        expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/game log/i);
    });

    it('draws the help button as an icon, not a typed question mark, and keeps its name', () => {
        setup();
        const help = screen.getByRole('button', { name: 'About the service calendar' });

        expect(help.querySelector('svg')).not.toBeNull();
        expect(help.textContent).toBe('');
    });
});
