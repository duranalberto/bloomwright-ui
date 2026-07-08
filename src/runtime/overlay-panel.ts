const globalScope = window as Window & {
  __overlayPanelEnhanced?: boolean;
};

if (!globalScope.__overlayPanelEnhanced) {
  globalScope.__overlayPanelEnhanced = true;

  const restoreFocus = new WeakMap<HTMLInputElement, HTMLElement>();
  let pageLock:
    | {
        scrollX: number;
        scrollY: number;
        restoreOnUnlock: boolean;
      }
    | undefined;
  let lastTouchY: number | undefined;

  const focusableSelector = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[role='button'][tabindex]:not([tabindex='-1'])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  const getModal = (input: HTMLInputElement): HTMLElement | null => {
    const modal = input.nextElementSibling;
    return modal instanceof HTMLElement && modal.classList.contains("modal")
      ? modal
      : null;
  };

  const getTrigger = (input: HTMLInputElement): HTMLElement | null => {
    if (!input.id) return null;
    return document.querySelector<HTMLElement>(
      `[for="${CSS.escape(input.id)}"][aria-haspopup="dialog"]`,
    );
  };

  const closeModal = (input: HTMLInputElement) => {
    input.checked = false;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const getOverlayControl = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;

    const control = target.closest<HTMLElement>("[role='button'][for]");
    const targetId = control?.getAttribute("for");
    if (!control || !targetId) return null;

    const input = document.getElementById(targetId);
    if (
      !(input instanceof HTMLInputElement) ||
      !input.classList.contains("ui-overlay-panel-toggle")
    ) {
      return null;
    }

    return { control, input };
  };

  const getOpenInputs = () => {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>(
        ".ui-overlay-panel-toggle:checked",
      ),
    );
  };

  const getOpenModal = (): HTMLElement | null => {
    const openInput = getOpenInputs().at(-1);

    return openInput ? getModal(openInput) : null;
  };

  const lockPageScroll = () => {
    if (pageLock) return;

    const { body } = document;
    pageLock = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      restoreOnUnlock: true,
    };

    body.dataset.overlayScrollLocked = "true";
  };

  const unlockPageScroll = () => {
    if (!pageLock) return;

    const { body } = document;
    const { restoreOnUnlock, scrollX, scrollY } = pageLock;
    delete body.dataset.overlayScrollLocked;
    pageLock = undefined;
    if (restoreOnUnlock) {
      window.scrollTo(scrollX, scrollY);
    }
  };

  const syncPageScrollLock = () => {
    if (getOpenInputs().length > 0) {
      lockPageScroll();
      return;
    }

    unlockPageScroll();
  };

  const resetPageScrollLock = () => {
    delete document.body.dataset.overlayScrollLocked;
    pageLock = undefined;
    lastTouchY = undefined;
  };

  const getPanelScroll = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const scrollArea = target.closest(
      ".ui-overlay-panel-modal .ui-panel-scroll",
    );
    return scrollArea instanceof HTMLElement ? scrollArea : null;
  };

  const canScrollBy = (element: HTMLElement, deltaY: number) => {
    if (deltaY === 0) return false;

    const atTop = element.scrollTop <= 0;
    const atBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 1;

    return !((deltaY < 0 && atTop) || (deltaY > 0 && atBottom));
  };

  const preventBackgroundWheel = (event: WheelEvent) => {
    if (!getOpenModal()) return;

    const scrollArea = getPanelScroll(event.target);
    if (scrollArea && canScrollBy(scrollArea, event.deltaY)) return;

    event.preventDefault();
  };

  const trackTouchStart = (event: TouchEvent) => {
    if (!getOpenModal()) return;

    lastTouchY = event.touches[0]?.clientY;
  };

  const preventBackgroundTouch = (event: TouchEvent) => {
    if (!getOpenModal()) return;

    const touchY = event.touches[0]?.clientY;
    const deltaY =
      lastTouchY === undefined || touchY === undefined
        ? 0
        : lastTouchY - touchY;
    lastTouchY = touchY;

    const scrollArea = getPanelScroll(event.target);
    if (scrollArea && canScrollBy(scrollArea, deltaY)) return;

    event.preventDefault();
  };

  const getKeyScrollDelta = (event: KeyboardEvent) => {
    const viewport = window.innerHeight;

    switch (event.key) {
      case "ArrowDown":
        return 48;
      case "ArrowUp":
        return -48;
      case "PageDown":
      case " ":
        return viewport * 0.8;
      case "PageUp":
        return viewport * -0.8;
      case "Home":
        return Number.NEGATIVE_INFINITY;
      case "End":
        return Number.POSITIVE_INFINITY;
      default:
        return undefined;
    }
  };

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    return (
      target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    );
  };

  const preventBackgroundKeyScroll = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;

    const modal = getOpenModal();
    const deltaY = getKeyScrollDelta(event);
    if (!modal || deltaY === undefined || isEditableTarget(event.target)) {
      return;
    }

    const scrollArea =
      getPanelScroll(event.target) ??
      modal.querySelector<HTMLElement>(".ui-panel-scroll");
    if (!scrollArea) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    if (deltaY === Number.NEGATIVE_INFINITY) {
      scrollArea.scrollTop = 0;
      return;
    }

    if (deltaY === Number.POSITIVE_INFINITY) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
      return;
    }

    scrollArea.scrollBy({ top: deltaY, behavior: "auto" });
  };

  const getPreserveScrollLink = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;

    return target.closest<HTMLAnchorElement>(
      ".ui-overlay-panel-modal a[data-overlay-preserve-page-scroll]",
    );
  };

  const isFocusable = (element: HTMLElement) => {
    if (element.matches("[disabled], [aria-disabled='true']")) return false;

    const style = window.getComputedStyle(element);
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      element.getClientRects().length > 0
    );
  };

  const getFocusableElements = (modal: HTMLElement) => {
    return Array.from(
      modal.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter(isFocusable);
  };

  const focusFirstControl = (modal: HTMLElement) => {
    const focusTarget =
      modal.querySelector<HTMLElement>("[data-modal-close]") ??
      getFocusableElements(modal)[0] ??
      modal;

    focusTarget.focus();
  };

  const activateOverlayControlFromKeyboard = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return false;

    const overlayControl = getOverlayControl(event.target);
    if (!overlayControl) return false;

    event.preventDefault();
    overlayControl.control.click();
    return true;
  };

  const trapModalFocus = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return false;

    const modal = getOpenModal();
    if (!modal) return false;

    const focusableElements = getFocusableElements(modal);
    if (focusableElements.length === 0) {
      event.preventDefault();
      modal.focus();
      return true;
    }

    const activeElement = document.activeElement;
    const activeIndex =
      activeElement instanceof HTMLElement
        ? focusableElements.indexOf(activeElement)
        : -1;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);
    if (!firstElement || !lastElement) return false;

    if (event.shiftKey) {
      if (activeIndex <= 0) {
        event.preventDefault();
        lastElement.focus();
        return true;
      }

      return false;
    }

    if (activeIndex === -1 || activeIndex === focusableElements.length - 1) {
      event.preventDefault();
      firstElement.focus();
      return true;
    }

    return false;
  };

  const isSamePageHashLink = (link: HTMLAnchorElement) => {
    if (!link.hash) return false;

    const linkUrl = new URL(link.href, window.location.href);
    return (
      linkUrl.origin === window.location.origin &&
      linkUrl.pathname === window.location.pathname &&
      linkUrl.search === window.location.search
    );
  };

  const preserveNavigationScroll = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !pageLock
    ) {
      return;
    }

    const link = getPreserveScrollLink(event.target);
    if (!link || !isSamePageHashLink(link)) return;

    const hash = new URL(link.href, window.location.href).hash.slice(1);
    const targetId = (() => {
      try {
        return decodeURIComponent(hash);
      } catch {
        return "";
      }
    })();
    if (!targetId || !document.getElementById(targetId)) return;

    pageLock.restoreOnUnlock = false;
  };

  document.addEventListener("change", (event) => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) ||
      !input.classList.contains("ui-overlay-panel-toggle")
    ) {
      return;
    }

    syncPageScrollLock();

    if (input.checked) {
      const activeElement = document.activeElement;
      const trigger = getTrigger(input);
      const focusOrigin =
        activeElement instanceof HTMLElement && activeElement !== document.body
          ? activeElement
          : trigger;

      if (focusOrigin) {
        restoreFocus.set(input, focusOrigin);
      }

      requestAnimationFrame(() => {
        const modal = getModal(input);
        if (modal) {
          focusFirstControl(modal);
        }
      });

      return;
    }

    const focusTarget = restoreFocus.get(input);
    if (focusTarget?.isConnected) {
      focusTarget.focus();
      return;
    }

    getTrigger(input)?.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (activateOverlayControlFromKeyboard(event)) return;
    if (trapModalFocus(event)) return;

    if (event.key !== "Escape") return;

    const openModals = getOpenInputs();
    const currentModal = openModals.at(-1);

    if (currentModal) {
      closeModal(currentModal);
    }
  });

  document.addEventListener("keydown", preventBackgroundKeyScroll);
  document.addEventListener("astro:before-swap", resetPageScrollLock);
  document.addEventListener("astro:page-load", syncPageScrollLock);
  document.addEventListener("click", preserveNavigationScroll, {
    capture: true,
  });

  document.addEventListener("wheel", preventBackgroundWheel, {
    capture: true,
    passive: false,
  });
  document.addEventListener("touchstart", trackTouchStart, {
    capture: true,
    passive: true,
  });
  document.addEventListener("touchmove", preventBackgroundTouch, {
    capture: true,
    passive: false,
  });
}

export {};
