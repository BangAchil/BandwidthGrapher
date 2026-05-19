import type { BandwidthGrapherOptions, BandwidthPoint, BandwidthRange } from "./types";

export class BandwidthGrapherEngine {
  readonly container: HTMLElement;
  private options: BandwidthGrapherOptions;
  private points: BandwidthPoint[] = [];
  private range: BandwidthRange | null = null;

  constructor(container: HTMLElement, options: BandwidthGrapherOptions = {}) {
    this.container = container;
    this.options = options;
  }

  setData(points: BandwidthPoint[]): void {
    this.points = points.slice();
    this.render();
  }

  appendPoint(point: BandwidthPoint): void {
    this.points.push(point);
    this.trimLiveBuffer();
    this.render();
  }

  pushTimeout(time: Date = new Date()): void {
    this.appendPoint({ time, inboundBps: null, outboundBps: null, status: "timeout" });
  }

  setRange(start: BandwidthRange["start"], end: BandwidthRange["end"]): void {
    this.range = { start, end };
    this.render();
  }

  resetRange(): void {
    this.range = null;
    this.render();
  }

  setOptions(options: Partial<BandwidthGrapherOptions>): void {
    this.options = { ...this.options, ...options };
    this.render();
  }

  resize(): void {
    this.render();
  }

  exportImage(): string | null {
    return null;
  }

  destroy(): void {
    this.points = [];
  }

  private trimLiveBuffer(): void {
    const maxDataPoints = this.options.maxDataPoints ?? 400;
    if (this.points.length > maxDataPoints) {
      this.points = this.points.slice(this.points.length - maxDataPoints);
    }
  }

  private render(): void {
    this.container.dataset.bandwidthGrapher = "mounted";
  }
}
