import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Loading from './Loading';

afterEach(cleanup);

describe('Loading', () => {
    it('is the page landmark when it stands in for a whole page', () => {
        render(<Loading />);

        expect(screen.getByRole('main').contains(screen.getByRole('status'))).toBe(true);
    });
    it('fills the screen, so the footer starts below the fold instead of jumping when content arrives', () => {
        render(<Loading />);

        expect(screen.getByRole('main').className).toContain('min-h-screen');
    });
    it('is just the status text inside a section', () => {
        render(<Loading inline />);

        expect(screen.queryByRole('main')).toBeNull();
        expect(screen.getByRole('status').textContent).toContain('Loading');
    });
});
