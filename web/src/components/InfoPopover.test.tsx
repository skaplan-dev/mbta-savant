import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import InfoPopover from './InfoPopover';

afterEach(cleanup);

describe('InfoPopover', () => {
    it('opens on click and Esc closes it', async () => {
        render(
            <InfoPopover trigger="Term" triggerClass="">
                Definition
            </InfoPopover>
        );
        const button = screen.getByRole('button', { name: 'Term' });
        expect(screen.queryByText('Definition')).toBeNull();
        await act(async () => fireEvent.click(button));
        expect(screen.getByText('Definition')).toBeTruthy();
        expect(button.getAttribute('aria-expanded')).toBe('true');
        await act(async () => fireEvent.keyDown(button, { key: 'Escape' }));
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });
});
