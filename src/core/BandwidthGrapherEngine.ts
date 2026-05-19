import { resolveOptions } from "./defaultOptions";
import { formatBps, formatClock } from "./format";
import { calculateGridIntervalSeconds, calculateNiceCeiling } from "./scale";
import { calculateStats, type BandwidthStats } from "./stats";
import type {
  BandwidthGrapherOptions,
  BandwidthGrapherSnapshot,
  BandwidthGrapherUserOptions,
  BandwidthPoint,
  BandwidthRange,
} from "./types";

type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type Layout = {
  width: number;
  height: number;
  padding: Padding;
  graphWidth: number;
  graphHeight: number;
};

const defaultPadding: Padding = { top: 30, right: 15, bottom: 75, left: 60 };

export class BandwidthGrapherEngine {
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly tooltip: HTMLDivElement;

  private readonly ctx: CanvasRenderingContext2D;
  private options: BandwidthGrapherOptions;
  private points: BandwidthPoint[] = [];
  private range: BandwidthRange | null = null;
  private currentMaxY: number;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  private readonly handleMouseMoveBound = (event: MouseEvent) => this.handleMouseMove(event);
  private readonly handleMouseOutBound = () => this.handleMouseOut();

  constructor(container: HTMLElement, options: BandwidthGrapherUserOptions = {}) {
    this.container = container;
    this.options = resolveOptions(options);
    this.currentMaxY = this.options.scale.autoScale
      ? this.options.scale.initialMaxBps
      : this.options.scale.maxY ?? this.options.scale.initialMaxBps;

    this.container.classList.add("bandwidth-grapher");
    if (!this.container.style.position) this.container.style.position = "relative";
    if (!this.container.style.overflow) this.container.style.overflow = "hidden";

    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";

    this.tooltip = document.createElement("div");
    this.tooltip.style.position = "absolute";
    this.tooltip.style.display = "none";
    this.tooltip.style.pointerEvents = "none";
    this.tooltip.style.padding = "6px 8px";
    this.tooltip.style.borderRadius = "4px";
    this.tooltip.style.font = "11px Arial, sans-serif";
    this.tooltip.style.zIndex = "2";

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("BandwidthGrapher needs a 2D canvas context.");
    this.ctx = ctx;

    this.container.append(this.canvas, this.tooltip);
    this.canvas.addEventListener("mousemove", this.handleMouseMoveBound);
    this.canvas.addEventListener("mouseout", this.handleMouseOutBound);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }

    this.render();
  }

  setData(points: BandwidthPoint[]): void {
    this.points = points.map(normalizePoint);
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  appendPoint(point: BandwidthPoint): void {
    this.points.push(normalizePoint(point));
    this.trimLiveBuffer();
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  pushTimeout(time: Date = new Date()): void {
    this.appendPoint({ time, inboundBps: null, outboundBps: null, status: "timeout" });
  }

  setRange(start: BandwidthRange["start"], end: BandwidthRange["end"]): void {
    this.range = { start, end };
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  resetRange(): void {
    this.range = null;
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  setOptions(options: BandwidthGrapherUserOptions): void {
    this.options = resolveOptions({
      ...this.options,
      ...options,
      title: {
        ...this.options.title,
        ...options.title,
      },
      colors: {
        ...this.options.colors,
        ...options.colors,
      },
      legend: {
        ...this.options.legend,
        ...options.legend,
      },
      scale: {
        ...this.options.scale,
        ...options.scale,
      },
      interaction: {
        ...this.options.interaction,
        ...options.interaction,
      },
    });
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  resize(): void {
    this.render();
  }

  exportImage(type = "image/png", quality?: number): string {
    this.drawGraph();
    return this.canvas.toDataURL(type, quality);
  }

  getSnapshot(): BandwidthGrapherSnapshot {
    return {
      points: this.points.slice(),
      range: this.range,
      options: this.options,
    };
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("mousemove", this.handleMouseMoveBound);
    this.canvas.removeEventListener("mouseout", this.handleMouseOutBound);
    this.canvas.remove();
    this.tooltip.remove();
    this.points = [];
  }

  private render(highlightX: number | null = null): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.drawGraph(highlightX);
    });
  }

  private drawGraph(highlightX: number | null = null): void {
    const layout = this.createLayout();
    const { width, height, padding, graphWidth, graphHeight } = layout;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.options.colors.background;
    ctx.fillRect(0, 0, width, height);

    this.drawTitles(padding);
    this.drawGridAndLabels(layout);
    this.drawThresholds(layout);

    const visiblePoints = this.getVisiblePoints();
    const inboundData = visiblePoints.map((point) => point.inboundBps);
    const outboundData = visiblePoints.map((point) => point.outboundBps);

    if (this.options.graphStyle === "linear") {
      this.drawAreaLinear(inboundData, this.options.colors.inboundFill, layout);
      this.drawLineLinear(outboundData, this.options.colors.outboundLine, layout);
    } else {
      this.drawAreaStep(inboundData, this.options.colors.inboundFill, layout);
      this.drawLineStep(outboundData, this.options.colors.outboundLine, layout);
    }

    this.drawTimeoutRanges(visiblePoints, layout);
    this.drawBorder(layout);
    this.drawSummary(layout);
    this.drawWatermark(width, height);

    if (highlightX !== null && this.options.interaction.hoverLine) {
      this.drawHighlightLine(padding, graphHeight, highlightX);
    }
  }

  private createLayout(): Layout {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(1, Math.floor(rect.width || this.container.clientWidth || 800));
    const cssHeight = Math.max(1, Math.floor(rect.height || this.container.clientHeight || 320));

    this.canvas.width = Math.floor(cssWidth * dpr);
    this.canvas.height = Math.floor(cssHeight * dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padding = { ...defaultPadding };
    return {
      width: cssWidth,
      height: cssHeight,
      padding,
      graphWidth: cssWidth - padding.left - padding.right,
      graphHeight: cssHeight - padding.top - padding.bottom,
    };
  }

  private drawGridAndLabels(layout: Layout): void {
    const { padding, graphWidth, graphHeight } = layout;
    const ctx = this.ctx;

    ctx.fillStyle = this.options.colors.text;
    ctx.font = "10px Arial, sans-serif";
    ctx.strokeStyle = this.options.colors.grid;
    ctx.lineWidth = 0.5;

    const yGridCount = 5;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let index = 0; index <= yGridCount; index += 1) {
      const y = padding.top + (index * graphHeight) / yGridCount;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + graphWidth, y);
      ctx.stroke();

      const value = this.currentMaxY * (1 - index / yGridCount);
      ctx.fillText(this.formatBps(value), padding.left - 8, y);
    }

    const { startTime, endTime } = this.getVisibleTimeRange();
    const totalDurationMs = Math.max(1, endTime - startTime);
    const gridIntervalMs = calculateGridIntervalSeconds(totalDurationMs / 1000) * 1000;
    const firstLabelTime = Math.ceil(startTime / gridIntervalMs) * gridIntervalMs;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let time = firstLabelTime; time < endTime; time += gridIntervalMs) {
      const x = padding.left + ((time - startTime) / totalDurationMs) * graphWidth;
      if (x <= padding.left || x >= padding.left + graphWidth) continue;

      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + graphHeight);
      ctx.stroke();
      ctx.fillText(formatClock(time), x, padding.top + graphHeight + 5);
    }
  }

  private drawThresholds(layout: Layout): void {
    const { padding, graphWidth, graphHeight } = layout;
    const ctx = this.ctx;

    for (const threshold of this.options.thresholds) {
      const y = padding.top + graphHeight - (threshold.valueBps / this.currentMaxY) * graphHeight;
      if (y < padding.top || y > padding.top + graphHeight) continue;

      ctx.save();
      ctx.strokeStyle = threshold.color ?? this.options.colors.thresholdLine;
      ctx.lineWidth = 1;
      ctx.setLineDash(threshold.lineDash ?? [4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + graphWidth, y);
      ctx.stroke();
      ctx.restore();

      if (threshold.label) {
        ctx.fillStyle = threshold.color ?? this.options.colors.thresholdLine;
        ctx.font = "10px Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(threshold.label, padding.left + graphWidth - 4, y - 2);
      }
    }
  }

  private drawAreaLinear(data: Array<number | null>, fillColor: string, layout: Layout): void {
    const { padding, graphWidth, graphHeight } = layout;
    if (data.length === 0) return;

    const stepWidth = graphWidth / Math.max(1, data.length - 1);
    const ctx = this.ctx;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + graphHeight);

    data.forEach((point, index) => {
      const x = padding.left + index * stepWidth;
      const yValue = ((point ?? 0) / this.currentMaxY) * graphHeight * this.options.areaHeightFactor;
      ctx.lineTo(x, padding.top + graphHeight - yValue);
    });

    ctx.lineTo(padding.left + graphWidth, padding.top + graphHeight);
    ctx.closePath();
    ctx.fill();
  }

  private drawLineLinear(data: Array<number | null>, lineColor: string, layout: Layout): void {
    const { padding, graphWidth, graphHeight } = layout;
    if (data.length === 0) return;

    const ctx = this.ctx;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = this.options.outboundLineWidth;
    ctx.lineJoin = "bevel";
    ctx.beginPath();

    let lineActive = false;
    data.forEach((point, index) => {
      const x = padding.left + (index / Math.max(1, data.length - 1)) * graphWidth;

      if (point !== null) {
        const y = padding.top + graphHeight - (point / this.currentMaxY) * graphHeight;
        if (!lineActive) {
          ctx.moveTo(x, y);
          lineActive = true;
        } else {
          ctx.lineTo(x, y);
        }
      } else {
        lineActive = false;
      }
    });

    ctx.stroke();
  }

  private drawLineStep(data: Array<number | null>, lineColor: string, layout: Layout): void {
    const { padding, graphWidth, graphHeight } = layout;
    if (data.length === 0) return;

    const ctx = this.ctx;
    const stepWidth = graphWidth / Math.max(1, data.length - 1);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = this.options.outboundLineWidth;
    ctx.lineJoin = "bevel";
    ctx.beginPath();

    let hasActiveLine = false;
    let lastY = padding.top + graphHeight;

    data.forEach((point, index) => {
      const x = padding.left + index * stepWidth;
      if (point === null) {
        hasActiveLine = false;
        return;
      }

      const y = padding.top + graphHeight - (point / this.currentMaxY) * graphHeight;
      if (!hasActiveLine) {
        ctx.moveTo(x, y);
        hasActiveLine = true;
      } else {
        ctx.lineTo(x, lastY);
        ctx.lineTo(x, y);
      }
      lastY = y;
    });

    ctx.stroke();
  }

  private drawAreaStep(data: Array<number | null>, fillColor: string, layout: Layout): void {
    const { padding, graphWidth, graphHeight } = layout;
    if (data.length === 0) return;

    const ctx = this.ctx;
    const stepWidth = graphWidth / Math.max(1, data.length - 1);
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + graphHeight);

    let lastY = padding.top + graphHeight;
    data.forEach((point, index) => {
      const x = padding.left + index * stepWidth;
      const yValue = ((point ?? 0) / this.currentMaxY) * graphHeight * this.options.areaHeightFactor;
      const y = padding.top + graphHeight - yValue;
      ctx.lineTo(x, lastY);
      ctx.lineTo(x, y);
      lastY = y;
    });

    ctx.lineTo(padding.left + graphWidth, lastY);
    ctx.lineTo(padding.left + graphWidth, padding.top + graphHeight);
    ctx.closePath();
    ctx.fill();
  }

  private drawTimeoutRanges(points: BandwidthPoint[], layout: Layout): void {
    const { padding, graphWidth, graphHeight } = layout;
    if (points.length === 0) return;

    const ctx = this.ctx;
    const stepWidth = graphWidth / Math.max(1, points.length - 1);
    const graphLeft = padding.left;
    const graphRight = padding.left + graphWidth;

    ctx.fillStyle = this.options.colors.timeoutFill;

    let rangeStartIndex: number | null = null;

    points.forEach((point, index) => {
      const isTimeout = isTimeoutPoint(point);

      if (isTimeout && rangeStartIndex === null) {
        rangeStartIndex = index;
      }

      const isLastPoint = index === points.length - 1;
      if (rangeStartIndex === null || (isTimeout && !isLastPoint)) return;

      const rangeEndIndex = isTimeout && isLastPoint ? index : index - 1;
      const startX = rangeStartIndex === 0 ? graphLeft : padding.left + rangeStartIndex * stepWidth - stepWidth / 2;
      const endX = rangeEndIndex === points.length - 1 ? graphRight : padding.left + rangeEndIndex * stepWidth + stepWidth / 2;
      const x = Math.max(graphLeft, Math.floor(startX));
      const width = Math.max(1, Math.ceil(Math.min(graphRight, endX) - x));

      ctx.fillRect(x, padding.top, width, graphHeight);
      rangeStartIndex = null;
    });
  }

  private drawBorder(layout: Layout): void {
    const { padding, graphWidth, graphHeight } = layout;
    this.ctx.strokeStyle = this.options.colors.border;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(padding.left, padding.top, graphWidth, graphHeight);
  }

  private drawSummary(layout: Layout): void {
    if (!this.options.legend.visible) return;

    const points = this.getVisiblePoints();
    const inboundStats = calculateStats(points.map((point) => point.inboundBps));
    const outboundStats = calculateStats(points.map((point) => point.outboundBps));
    const y = layout.height - 45;

    this.ctx.font = "11px Arial, sans-serif";
    this.drawSummaryLine(y + 5, layout.padding.left, layout.graphWidth, this.options.colors.inboundFill, this.options.legend.inboundLabel, inboundStats);
    this.drawSummaryLine(y + 30, layout.padding.left, layout.graphWidth, this.options.colors.outboundLine, this.options.legend.outboundLabel, outboundStats);
  }

  private drawSummaryLine(y: number, x: number, width: number, color: string, label: string, stats: BandwidthStats): void {
    const colorBoxSize = 10;
    const ctx = this.ctx;

    ctx.fillStyle = color;
    ctx.fillRect(x, y - colorBoxSize / 2, colorBoxSize, colorBoxSize);

    ctx.fillStyle = this.options.colors.textSummary;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + colorBoxSize + 5, y);

    ctx.textAlign = "right";
    const colWidth = (width - 100) / 3;
    ctx.fillText(`Current: ${this.formatBps(stats.current)}`, x + 100 + colWidth, y);
    ctx.fillText(`Average: ${this.formatBps(stats.avg)}`, x + 100 + colWidth * 2, y);
    ctx.fillText(`Maximum: ${this.formatBps(stats.max)}`, x + 100 + colWidth * 3, y);
  }

  private drawTitles(padding: Padding): void {
    const ctx = this.ctx;
    const title = this.options.title;

    ctx.fillStyle = this.options.colors.text;
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const hostText = [title.host, title.ip ? `(${title.ip})` : ""].filter(Boolean).join(" ");
    ctx.fillText(hostText, padding.left, 10);

    ctx.textAlign = "right";
    const interfaceText = title.interfaceName ? `Interface: ${title.interfaceName}` : "";
    ctx.fillText(interfaceText, this.canvas.clientWidth - padding.right, 10);
  }

  private drawWatermark(width: number, height: number): void {
    if (!this.options.watermarkText) return;

    const ctx = this.ctx;
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillStyle = this.options.colors.textWatermark;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.options.watermarkText, width - 10, height - 2);
  }

  private drawHighlightLine(padding: Padding, graphHeight: number, highlightX: number): void {
    this.ctx.strokeStyle = this.options.colors.gridHighlight;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(highlightX, padding.top);
    this.ctx.lineTo(highlightX, padding.top + graphHeight);
    this.ctx.stroke();
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.options.interaction.tooltip) return;

    const layout = this.createLayout();
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { padding, graphWidth } = layout;

    const inside = x > padding.left && x < layout.width - padding.right && y > padding.top && y < layout.height - padding.bottom;
    if (!inside) {
      this.handleMouseOut();
      return;
    }

    const visiblePoints = this.getVisiblePoints();
    const index = Math.round(((x - padding.left) / graphWidth) * Math.max(1, visiblePoints.length - 1));
    const point = visiblePoints[index];
    if (!point) return;

    this.tooltip.style.display = "block";
    this.tooltip.style.background = this.options.colors.tooltipBackground;
    this.tooltip.style.color = this.options.colors.tooltipText;
    this.tooltip.innerHTML = [
      formatClock(point.time),
      `In: ${this.formatBps(point.inboundBps)}`,
      `Out: ${this.formatBps(point.outboundBps)}`,
      point.status && point.status !== "ok" ? `Status: ${point.status}` : "",
    ].filter(Boolean).join("<br>");

    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;
    const offset = 15;
    const left = x + offset + tooltipWidth > layout.width ? x - tooltipWidth - offset : x + offset;
    const top = y - offset - tooltipHeight < 0 ? y + offset : y - tooltipHeight - offset;

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.drawGraph(x);
  }

  private handleMouseOut(): void {
    this.tooltip.style.display = "none";
    this.render();
  }

  private updateAutoScale(): void {
    const visiblePoints = this.getVisiblePoints();
    const values = visiblePoints
      .flatMap((point) => [point.inboundBps, point.outboundBps])
      .filter((value): value is number => value !== null && value >= 0);
    const peak = values.length > 0 ? Math.max(...values) : 0;

    const upperTrigger = this.currentMaxY;
    const lowerTrigger = this.currentMaxY * 0.5;

    if (peak >= upperTrigger || peak < lowerTrigger) {
      const idealMax = peak * this.options.scale.headroom;
      let nextMax = calculateNiceCeiling(idealMax, this.options.scale.initialMaxBps);
      nextMax = Math.max(nextMax, this.options.scale.initialMaxBps);
      nextMax = Math.min(nextMax, this.options.scale.hardCapBps);
      this.currentMaxY = nextMax;
    }

    if (!this.options.scale.autoScale && this.options.scale.maxY) {
      this.currentMaxY = this.options.scale.maxY;
    }
  }

  private getVisiblePoints(): BandwidthPoint[] {
    if (!this.range) return this.points;

    const start = toTime(this.range.start);
    const end = toTime(this.range.end);
    return this.points.filter((point) => {
      const time = toTime(point.time);
      return time >= start && time <= end;
    });
  }

  private getVisibleTimeRange(): { startTime: number; endTime: number } {
    if (this.range) {
      return {
        startTime: toTime(this.range.start),
        endTime: toTime(this.range.end),
      };
    }

    const visiblePoints = this.getVisiblePoints();
    const lastPoint = visiblePoints[visiblePoints.length - 1];
    const endTime = lastPoint ? toTime(lastPoint.time) : Date.now();
    const totalDurationMs = this.options.maxDataPoints * this.options.intervalSeconds * 1000;
    return {
      startTime: endTime - totalDurationMs,
      endTime,
    };
  }

  private formatBps(value: number | null | undefined): string {
    return value !== null && value !== undefined && this.options.yAxisFormatter
      ? this.options.yAxisFormatter(value)
      : formatBps(value);
  }

  private trimLiveBuffer(): void {
    if (this.range) return;
    if (this.points.length > this.options.maxDataPoints) {
      this.points = this.points.slice(this.points.length - this.options.maxDataPoints);
    }
  }
}

function normalizePoint(point: BandwidthPoint): BandwidthPoint {
  return {
    ...point,
    status: point.status ?? "ok",
  };
}

function isTimeoutPoint(point: BandwidthPoint): boolean {
  return point.status === "timeout" || point.status === "error" || point.inboundBps === null || point.outboundBps === null;
}

function toTime(value: Date | number | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
