type DraggableOptions = {
    canEdit: boolean;
    rank: number;
}

type DropzoneOptions = DraggableOptions & {
    onDrop: (srcRank: number, targetRank: number) => Promise<void>;
}

type DropzoneState = DropzoneOptions & {
    dropEffect: "move" | "none" | "copy" | "link";
}

export function draggable(node: HTMLElement, options: DraggableOptions) {
    if (!options.canEdit) {
        return;
    }
    let state = {
        rank: options.rank
    };

    node.draggable = true;
    node.style.touchAction = 'pan-y';
    node.style.cursor = 'grab';

    const handleDragStart = (e: DragEvent) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', JSON.stringify(state));
        }
    };
    node.addEventListener('dragstart', handleDragStart);

    return {
        update(options: DraggableOptions) {
            state = {
                rank: options.rank
            }
        },
        destroy() {
            node.removeEventListener('dragstart', handleDragStart);
        }
    }
}

export function dropzone(node: HTMLElement, options: DropzoneOptions) {
    if (!options.canEdit) {
        return;
    }
    const state: DropzoneState = {
        dropEffect: 'move',
        ...options
    }

    // Shows an insertion line on the edge of the row where the dragged item
    // would land: 'drop-before' (top) or 'drop-after' (bottom).
    const clearIndicator = () => {
        node.classList.remove('drop-before', 'drop-after');
    };

    const handleDragLeave = (e: DragEvent) => {
        // Ignore moves between child elements; only clear when the pointer
        // actually leaves the row.
        if (e.relatedTarget instanceof Node && node.contains(e.relatedTarget)) {
            return;
        }
        clearIndicator();
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = state.dropEffect;
        }
        const rect = node.getBoundingClientRect();
        const isBottomHalf = (e.clientY - rect.top) > rect.height / 2;
        node.classList.toggle('drop-after', isBottomHalf);
        node.classList.toggle('drop-before', !isBottomHalf);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        clearIndicator();

        // Get data from dragged item
        if (!e.dataTransfer) return;
        const srcData = JSON.parse(e.dataTransfer.getData('text/plain'));

        // Calculate target rank based on drop position.
        // Use clientY relative to the dropzone row rather than e.offsetY, which
        // is relative to the child element under the cursor and would give an
        // inconsistent position.
        const rect = node.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        let targetRank = state.rank;

        // If dropped in bottom half, increment target rank
        if (offsetY > rect.height / 2) {
            targetRank += 1;
        }

        // Adjust for item removal position
        if (srcData.rank < targetRank) {
            targetRank -= 1;
        }

        // Call the provided onDrop callback
        state.onDrop(srcData.rank, targetRank);
    };

    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('drop', handleDrop);

    return {
        update(newOptions: DropzoneOptions) {
            // Keep the rank (and callback) in sync after a reorder refreshes the
            // list; without this the dropzone keeps its original mount-time rank
            // and later drops are computed against a stale position.
            state.rank = newOptions.rank;
            state.onDrop = newOptions.onDrop;
            state.canEdit = newOptions.canEdit;
        },
        destroy() {
            node.removeEventListener('dragleave', handleDragLeave);
            node.removeEventListener('dragover', handleDragOver);
            node.removeEventListener('drop', handleDrop);
        }
    };
}