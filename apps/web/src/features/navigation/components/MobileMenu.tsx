'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Wordmark } from '@/components/Wordmark';

import { PRIMARY_LINKS, UTILITY_LINKS } from '../nav-links.ts';
import { CloseIcon, MenuIcon } from './icons.tsx';

const DIALOG_ID = 'mobile-menu';

/**
 * Mobile navigation below 768 px (design D4): a native modal <dialog>, which
 * makes the page behind it inert and closes on Escape. Focus is moved into the
 * menu on open, kept inside it with Tab/Shift+Tab, and returned to the trigger
 * on close. Link clicks close the menu.
 */
export function MobileMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, []);

  const show = () => {
    dialogRef.current?.showModal();
    setOpen(true);
  };
  const close = () => dialogRef.current?.close();

  // Wrap Tab/Shift+Tab so focus cycles through the menu's own controls only.
  const keepFocusInside = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href], button')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={DIALOG_ID}
        className="inline-flex min-h-11 min-w-11 items-center justify-center md:hidden"
      >
        <MenuIcon />
        <span className="sr-only">Menu</span>
      </button>

      <dialog
        ref={dialogRef}
        id={DIALOG_ID}
        aria-label="Menu"
        onKeyDown={keepFocusInside}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-paper p-0 text-ink opacity-100 backdrop:bg-ink/40 motion-safe:transition-opacity motion-safe:duration-200 starting:open:opacity-0 md:hidden"
      >
        <div className="flex h-header items-center justify-between border-b border-line px-4">
          <span className="text-[0.9375rem] leading-none">
            <Wordmark className="font-stretch-normal" />
          </span>
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
          >
            <CloseIcon />
            <span className="sr-only">Close menu</span>
          </button>
        </div>
        <nav aria-label="Menu" className="px-4 py-10">
          <ul className="space-y-4">
            {[...PRIMARY_LINKS, ...UTILITY_LINKS].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={close}
                  className="text-display font-black uppercase decoration-brand decoration-4 underline-offset-8 font-stretch-expanded hover:underline focus-visible:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
