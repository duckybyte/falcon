class MinHeap {
    constructor() { this.heap = []; }

    push(node) {
        let i = this.heap.length - 1;
        this.heap.push(node);

        while (i > 0) {
            const p = (i - 1) >> 1;

            if (this.heap[i].f >= this.heap[p].f) break;
            [this.heap[i], this.heap[p]] = [this.heap[p], this.heap[i]];
            i = p;
        }
    }

    pop() {
        if (this.heap.length === 0) return null;

        const top = this.heap[0];
        const bottom = this.heap.pop();

        if (this.heap.length > 0) {
            this.heap[0] = bottom;
            let i = 0;

            while (true) {
                let s = i;
                const l = (i << 1) + 1;
                const r = (i << 1) + 2;

                if (l < this.heap.length && this.heap[l].f < this.heap[s].f) s = l;
                if (r < this.heap.length && this.heap[r].f < this.heap[s].f) s = r;
                if (s === i) break;

                [this.heap[i], this.heap[s]] = [this.heap[s], this.heap[i]];
                i = s;
            }
        }

        return top;
    }

    isEmpty() {
        return this.heap.length === 0;
    }
}

let cachedGScore = new Float32Array(0);
let cachedParentIdx = new Int32Array(0);

function getBuffers(requiredSize) {
    if (requiredSize > cachedGScore.length) {
        cachedGScore = new Float32Array(requiredSize);
        cachedParentIdx = new Int32Array(requiredSize);
    }

    cachedGScore.fill(Infinity, 0, requiredSize);
    cachedParentIdx.fill(-1, 0, requiredSize);

    return [cachedGScore, cachedParentIdx];
}

const NEIGHBORS = [
    { x: 0, y: -1, cost: 1 }, { x: 0, y: 1, cost: 1 },
    { x: -1, y: 0, cost: 1 }, { x: 1, y: 0, cost: 1 },
    { x: -1, y: -1, cost: 1.414 }, { x: 1, y: -1, cost: 1.414 },
    { x: -1, y: 1, cost: 1.414 }, { x: 1, y: 1, cost: 1.414 }
];

function findPath(grid, xCells, yCells, start, goal) {
    const totalCells = xCells * yCells;
    const [gScore, parentIdx] = getBuffers(totalCells);
    const openSet = new MinHeap();

    const startIdx = (start.y * xCells) + start.x;
    const goalIdx = (goal.y * xCells) + goal.x;

    if (startIdx < 0 || startIdx >= totalCells || goalIdx < 0 || goalIdx >= totalCells) return [];

    gScore[startIdx] = 0;
    openSet.push({ idx: startIdx, f: heuristic(start, goal) });

    while (!openSet.isEmpty()) {
        const { idx: curIdx } = openSet.pop();

        if (curIdx === goalIdx) return reconstructPath(parentIdx, goalIdx, xCells);

        const curX = curIdx % xCells;
        const curY = (curIdx / xCells) | 0;

        for (let i = 0; i < NEIGHBORS.length; i++) {
            const move = NEIGHBORS[i];
            const nx = curX + move.x;
            const ny = curY + move.y;

            if (nx >= 0 && nx < xCells && ny >= 0 && ny < yCells) {
                const nIdx = (ny * xCells) + nx;
                const costMlt = grid[nIdx] === 2 ? 4 : 1;
                if (grid[nIdx] === 1) continue;

                const tentativeG = gScore[curIdx] + move.cost * costMlt;

                if (tentativeG < gScore[nIdx]) {
                    parentIdx[nIdx] = curIdx;
                    gScore[nIdx] = tentativeG;

                    const f = tentativeG + heuristic({ x: nx, y: ny }, goal);
                    openSet.push({ idx: nIdx, f });
                }
            }
        }
    }

    return [];
}

function heuristic(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
}

function reconstructPath(parentIdx, endIdx, xCells) {
    const path = [];
    let curr = endIdx;

    while (curr !== -1) {
        path.push({ x: curr % xCells, y: (curr / xCells) | 0 });
        curr = parentIdx[curr];
    }

    return path.reverse();
}

self.onmessage = (ev) => {
    const { grid, xCells, yCells, start, goal } = ev.data;
    const path = findPath(grid, xCells, yCells, start, goal);
    self.postMessage({ grid, path }, [grid.buffer]);
};