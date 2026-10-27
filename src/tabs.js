/**
 * Content-type tabs: click or tap a tab, or move with the arrow keys,
 * Home and End (roving tabindex, automatic activation).
 */

import { rovingIndex } from './shortcuts.js';

/**
 * Wires the tab list.
 * @param {HTMLElement} tablist element with role="tablist" holding tabs with data-type
 * @param {(type: string) => void} onSelect called with the chosen type
 * @returns {{sync: (type: string) => void}}
 */
export function createTypeTabs(tablist, onSelect) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) onSelect(tab.dataset.type);
  });

  tablist.addEventListener('keydown', (event) => {
    const index = rovingIndex(event.key, tabs.indexOf(document.activeElement), tabs.length);
    if (index === null) return;
    event.preventDefault();
    tabs[index].focus();
    onSelect(tabs[index].dataset.type);
  });

  return {
    sync(type) {
      for (const tab of tabs) {
        const selected = tab.dataset.type === type;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      }
    },
  };
}
