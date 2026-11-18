import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Tooltip from './Tooltip';

afterEach(cleanup);

const isOpen = () =>
    screen.getByRole('tooltip', { hidden: true }).className.split(' ').includes('visible');

describe('Tooltip', () => {
    it('opens on hover or focus and Esc dismisses it', () => {
        render(
            <Tooltip trigger="Term" triggerClass="">
                Definition
            </Tooltip>
        );
        const button = screen.getByRole('button', { name: 'Term' });
        expect(button.getAttribute('aria-describedby')).toBe(
            screen.getByRole('tooltip', { hidden: true }).id
        );
        expect(isOpen()).toBe(false);
        fireEvent.mouseEnter(button);
        expect(isOpen()).toBe(true);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(isOpen()).toBe(false);
        fireEvent.focus(button);
        expect(isOpen()).toBe(true);
    });
});
