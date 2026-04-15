export interface InventoryUiSlotViewModel {
  id: string;
  label: string;
  meta: string;
  detail: string;
  kind: 'weapon' | 'consumable';
  isActive: boolean;
}

export interface InventoryUiSyncPayload {
  capacity: number;
  items: InventoryUiSlotViewModel[];
}

export interface InventoryUiCallbacks {
  onToggleInventory?: () => void;
  onUseItem?: (itemId: string) => void;
  onDropItem?: (itemId: string) => void;
}

export class InventoryUiManager {
  private callbacks: InventoryUiCallbacks = {};
  private root: HTMLDivElement | null = null;
  private grid: HTMLDivElement | null = null;
  private contextMenu: HTMLDivElement | null = null;
  private isVisible = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || event.key.toLowerCase() !== 'i') {
      return;
    }

    event.preventDefault();
    this.callbacks.onToggleInventory?.();
  };

  init() {
    if (this.root) {
      return;
    }

    const root = document.createElement('div');
    root.id = 'inventory-overlay';
    root.className = 'inventory-overlay inventory-overlay--hidden';
    root.addEventListener('click', () => {
      this.hideContextMenu();
    });

    const shell = document.createElement('div');
    shell.className = 'inventory-shell';

    const panel = document.createElement('section');
    panel.className = 'inventory-panel';
    panel.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    const heading = document.createElement('div');
    heading.className = 'inventory-panel__heading';
    heading.textContent = 'Inventory';

    const subheading = document.createElement('div');
    subheading.className = 'inventory-panel__subheading';
    subheading.textContent = 'Select an item to use or drop it.';

    const grid = document.createElement('div');
    grid.className = 'inventory-grid';

    panel.appendChild(heading);
    panel.appendChild(subheading);
    panel.appendChild(grid);

    const stage = document.createElement('aside');
    stage.className = 'inventory-stage';

    const stageHint = document.createElement('div');
    stageHint.className = 'inventory-stage__hint';
    stageHint.textContent = 'Player preview remains visible here.';
    stage.appendChild(stageHint);

    const contextMenu = document.createElement('div');
    contextMenu.className =
      'inventory-context-menu inventory-context-menu--hidden';
    contextMenu.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    shell.appendChild(panel);
    shell.appendChild(stage);
    root.appendChild(shell);
    root.appendChild(contextMenu);
    document.body.appendChild(root);
    document.addEventListener('keydown', this.onKeyDown);

    this.root = root;
    this.grid = grid;
    this.contextMenu = contextMenu;
  }

  bindCallbacks(callbacks: InventoryUiCallbacks) {
    this.callbacks = callbacks;
  }

  setVisible(visible: boolean) {
    if (!this.root) {
      return;
    }

    if (this.isVisible === visible) {
      if (!visible) {
        this.hideContextMenu();
      }
      return;
    }

    this.isVisible = visible;
    this.root.classList.toggle('inventory-overlay--hidden', !visible);
    this.root.classList.toggle('inventory-overlay--visible', visible);

    if (!visible) {
      this.hideContextMenu();
    }
  }

  syncInventoryUi(payload: InventoryUiSyncPayload) {
    if (!this.grid) {
      return;
    }

    this.grid.replaceChildren();

    for (let slotIndex = 0; slotIndex < payload.capacity; slotIndex += 1) {
      const item = payload.items[slotIndex] ?? null;
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'inventory-slot';

      if (!item) {
        slot.classList.add('inventory-slot--empty');
        slot.disabled = true;
        this.grid.appendChild(slot);
        continue;
      }

      if (item.isActive) {
        slot.classList.add('inventory-slot--active');
      }

      const label = document.createElement('span');
      label.className = 'inventory-slot__label';
      label.textContent = item.label;

      const meta = document.createElement('span');
      meta.className = 'inventory-slot__meta';
      meta.textContent = item.meta;

      const detail = document.createElement('span');
      detail.className = 'inventory-slot__detail';
      detail.textContent = item.detail;

      slot.title = item.detail;
      slot.dataset.itemId = item.id;
      slot.appendChild(label);
      slot.appendChild(meta);
      slot.appendChild(detail);
      slot.addEventListener('click', (event) => {
        event.stopPropagation();
        this.showContextMenu(item.id, event.clientX, event.clientY);
      });

      this.grid.appendChild(slot);
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.onKeyDown);
    this.root?.remove();
    this.root = null;
    this.grid = null;
    this.contextMenu = null;
    this.callbacks = {};
    this.isVisible = false;
  }

  private showContextMenu(itemId: string, x: number, y: number) {
    if (!this.contextMenu) {
      return;
    }

    this.contextMenu.replaceChildren();
    this.contextMenu.classList.remove('inventory-context-menu--hidden');
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;

    const useButton = document.createElement('button');
    useButton.type = 'button';
    useButton.className = 'inventory-context-menu__button';
    useButton.textContent = 'USE';
    useButton.addEventListener('click', () => {
      this.callbacks.onUseItem?.(itemId);
      this.hideContextMenu();
    });

    const dropButton = document.createElement('button');
    dropButton.type = 'button';
    dropButton.className =
      'inventory-context-menu__button inventory-context-menu__button--danger';
    dropButton.textContent = 'DROP';
    dropButton.addEventListener('click', () => {
      this.callbacks.onDropItem?.(itemId);
      this.hideContextMenu();
    });

    this.contextMenu.appendChild(useButton);
    this.contextMenu.appendChild(dropButton);
  }

  private hideContextMenu() {
    if (!this.contextMenu) {
      return;
    }

    this.contextMenu.classList.add('inventory-context-menu--hidden');
    this.contextMenu.replaceChildren();
  }
}
