export default abstract class ModModule {
    run() {
        if (!this.canExecute()) return;
        this.execute();
    }

    private isInitialized = false;

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.initialize();
    }

    protected abstract initialize(): void;
    protected abstract canExecute(): boolean;
    protected abstract execute(): void;
    abstract update(): void;
}