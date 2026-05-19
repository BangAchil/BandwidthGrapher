import { resolveOptions } from "./defaultOptions";
import { formatBps, formatClock } from "./format";
import { calculateGridIntervalSeconds, calculateNiceCeiling } from "./scale";
import { calculateStats, type BandwidthStats } from "./stats";
import type {
  BandwidthDataMode,
  BandwidthGrapherOptions,
  BandwidthGrapherSnapshot,
  BandwidthGrapherUserOptions,
  BandwidthPoint,
  BandwidthRange,
  BandwidthSetDataOptions,
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

type TimeRange = {
  startTime: number;
  endTime: number;
};

type SeriesKey = "inboundBps" | "outboundBps";

const defaultPadding: Padding = { top: 30, right: 15, bottom: 75, left: 60 };

export class BandwidthGrapherEngine {
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly tooltip: HTMLDivElement;

  private readonly ctx: CanvasRenderingContext2D;
  private options: BandwidthGrapherOptions;
  private points: BandwidthPoint[] = [];
  private range: BandwidthRange | null = null;
  private dataMode: BandwidthDataMode = "history-live";
  private followLive = true;
  private currentMaxY: number;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private isPanning = false;
  private panStartX = 0;
  private panStartRange: TimeRange | null = null;

  private readonly handleMouseMoveBound = (event: MouseEvent) => this.handleMouseMove(event);
  private readonly handleMouseOutBound = () => this.handleMouseOut();
  private readonly handleWheelBound = (event: WheelEvent) => this.handleWheel(event);
  private readonly handleMouseDownBound = (event: MouseEvent) => this.handleMouseDown(event);
  private readonly handleWindowMouseMoveBound = (event: MouseEvent) => this.handleWindowMouseMove(event);
  private readonly handleWindowMouseUpBound = () => this.handleWindowMouseUp();

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
    this.canvas.addEventListener("wheel", this.handleWheelBound, { passive: false });
    this.canvas.addEventListener("mousedown", this.handleMouseDownBound);
    window.addEventListener("mousemove", this.handleWindowMouseMoveBound);
    window.addEventListener("mouseup", this.handleWindowMouseUpBound);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }

    this.render();
  }

  setData(points: BandwidthPoint[], dataOptions: BandwidthSetDataOptions = {}): void {
    this.points = points.map(normalizePoint).sort(comparePointTime);

    if (dataOptions.mode) this.dataMode = dataOptions.mode;
    if (dataOptions.followLive !== undefined) this.followLive = dataOptions.followLive;

    if (dataOptions.range === "data" || (!dataOptions.range && this.dataMode === "history")) {
      this.fitDataRange();
    } else if (dataOptions.range) {
      this.setRange(dataOptions.range.start, dataOptions.range.end);
    } else if (this.range) {
      this.range = this.rangeFromTimeRange(this.clampTimeRange(toTime(this.range.start), toTime(this.range.end)));
    } else if (this.followLive) {
      this.range = null;
    }

    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  appendPoint(point: BandwidthPoint): void {
    this.points.push(normalizePoint(point));
    this.points.sort(comparePointTime);
    if (this.dataMode === "live") this.trimLiveBuffer();
    if (this.followLive) this.range = null;
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  pushTimeout(time: Date = new Date()): void {
    this.appendPoint({ time, inboundBps: null, outboundBps: null, status: "timeout" });
  }

  setMode(mode: BandwidthDataMode): void {
    this.dataMode = mode;
    if (mode === "live" || mode === "history-live") this.followLive = true;
    if (mode === "history") this.fitDataRange();
    this.render();
  }

  setRange(start: BandwidthRange["start"], end: BandwidthRange["end"]): void {
    this.range = this.rangeFromTimeRange(this.clampTimeRange(toTime(start), toTime(end)));
    this.followLive = false;
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  resetRange(): void {
    this.range = null;
    this.followLive = true;
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  fitDataRange(): void {
    const dataRange = this.getDataTimeRange();
    if (!dataRange) return;
    this.range = {
      start: dataRange.startTime,
      end: dataRange.endTime,
    };
    this.followLive = false;
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  zoom(factor: number, anchor?: Date | number | string): void {
    if (!Number.isFinite(factor) || factor <= 0) return;

    const currentRange = this.getVisibleTimeRange();
    const duration = currentRange.endTime - currentRange.startTime;
    const anchorTime = anchor !== undefined ? toTime(anchor) : currentRange.startTime + duration / 2;
    const nextDuration = this.clampRangeDuration(duration * factor);
    const ratio = duration <= 0 ? 0.5 : (anchorTime - currentRange.startTime) / duration;
    const startTime = anchorTime - nextDuration * ratio;
    const endTime = startTime + nextDuration;

    this.setRange(startTime, endTime);
  }

  zoomIn(anchor?: Date | number | string): void {
    this.zoom(0.75, anchor);
  }

  zoomOut(anchor?: Date | number | string): void {
    this.zoom(1.35, anchor);
  }

  panBy(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs === 0) return;

    const currentRange = this.getVisibleTimeRange();
    this.setRange(currentRange.startTime + deltaMs, currentRange.endTime + deltaMs);
  }

  panPercent(percent: number): void {
    const currentRange = this.getVisibleTimeRange();
    const duration = currentRange.endTime - currentRange.startTime;
    this.panBy(duration * percent);
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
      mode: this.dataMode,
      followLive: this.followLive,
      options: this.options,
    };
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("mousemove", this.handleMouseMoveBound);
    this.canvas.removeEventListener("mouseout", this.handleMouseOutBound);
    this.canvas.removeEventListener("wheel", this.handleWheelBound);
    this.canvas.removeEventListener("mousedown", this.handleMouseDownBound);
    window.removeEventListener("mousemove", this.handleWindowMouseMoveBound);
    window.removeEventListener("mouseup", this.handleWindowMouseUpBound);
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
    const { width, height, padding, graphHeight } = layout;
    const ctx = this.ctx;
    const visibleRange = this.getVisibleTimeRange();
    const visiblePoints = this.getVisiblePoints(visibleRange);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.options.colors.background;
    ctx.fillRect(0, 0, width, height);

    this.drawTitles(padding);
    this.drawGridAndLabels(layout, visibleRange);
    this.drawThresholds(layout);

    if (this.options.graphStyle === "linear") {
      this.drawAreaLinear(visiblePoints, "inboundBps", this.options.colors.inboundFill, layout, visibleRange);
      this.drawLineLinear(visiblePoints, "outboundBps", this.options.colors.outboundLine, layout, visibleRange);
    } else {
      this.drawAreaStep(visiblePoints, "inboundBps", this.options.colors.inboundFill, layout, visibleRange);
      this.drawLineStep(visiblePoints, "outboundBps", this.options.colors.outboundLine, layout, visibleRange);
    }

    this.drawTimeoutRanges(visiblePoints, layout, visibleRange);
    this.drawBorder(layout);
    this.drawSummary(layout, visiblePoints);
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
    const backingWidth = Math.floor(cssWidth * dpr);
    const backingHeight = Math.floor(cssHeight * dpr);

    if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
    if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;
    if (this.canvas.style.width !== `${cssWidth}px`) this.canvas.style.width = `${cssWidth}px`;
    if (this.canvas.style.height !== `${cssHeight}px`) this.canvas.style.height = `${cssHeight}px`;
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

  private drawGridAndLabels(layout: Layout, visibleRange: TimeRange): void {
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

    const totalDurationMs = Math.max(1, visibleRange.endTime - visibleRange.startTime);
    const gridIntervalMs = calculateGridIntervalSeconds(totalDurationMs / 1000) * 1000;
    const firstLabelTime = Math.ceil(visibleRange.startTime / gridIntervalMs) * gridIntervalMs;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let time = firstLabelTime; time < visibleRange.endTime; time += gridIntervalMs) {
      const x = this.xForTime(time, layout, visibleRange);
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

  private drawAreaLinear(points: BandwidthPoint[], seriesKey: SeriesKey, fillColor: string, layout: Layout, visibleRange: TimeRange): void {
    const { padding, graphHeight } = layout;
    if (points.length === 0) return;

    const ctx = this.ctx;
    const firstX = this.xForTime(points[0].time, layout, visibleRange);
    let lastX = firstX;

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(firstX, padding.top + graphHeight);

    points.forEach((point) => {
      const x = this.xForTime(point.time, layout, visibleRange);
      const yValue = ((point[seriesKey] ?? 0) / this.currentMaxY) * graphHeight * this.options.areaHeightFactor;
      ctx.lineTo(x, padding.top + graphHeight - yValue);
      lastX = x;
    });

    ctx.lineTo(lastX, padding.top + graphHeight);
    ctx.closePath();
    ctx.fill();
  }

  private drawLineLinear(points: BandwidthPoint[], seriesKey: SeriesKey, lineColor: string, layout: Layout, visibleRange: TimeRange): void {
    const { padding, graphHeight } = layout;
    if (points.length === 0) return;

    const ctx = this.ctx;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = this.options.outboundLineWidth;
    ctx.lineJoin = "bevel";
    ctx.beginPath();

    let lineActive = false;
    points.forEach((point) => {
      const value = point[seriesKey];
      const x = this.xForTime(point.time, layout, visibleRange);

      if (value !== null) {
        const y = padding.top + graphHeight - (value / this.currentMaxY) * graphHeight;
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

  private drawLineStep(points: BandwidthPoint[], seriesKey: SeriesKey, lineColor: string, layout: Layout, visibleRange: TimeRange): void {
    const { padding, graphHeight } = layout;
    if (points.length === 0) return;

    const ctx = this.ctx;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = this.options.outboundLineWidth;
    ctx.lineJoin = "bevel";
    ctx.beginPath();

    let hasActiveLine = false;
    let lastY = padding.top + graphHeight;

    points.forEach((point) => {
      const value = point[seriesKey];
      const x = this.xForTime(point.time, layout, visibleRange);
      if (value === null) {
        hasActiveLine = false;
        return;
      }

      const y = padding.top + graphHeight - (value / this.currentMaxY) * graphHeight;
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

  private drawAreaStep(points: BandwidthPoint[], seriesKey: SeriesKey, fillColor: string, layout: Layout, visibleRange: TimeRange): void {
    const { padding, graphHeight } = layout;
    if (points.length === 0) return;

    const ctx = this.ctx;
    const firstX = this.xForTime(points[0].time, layout, visibleRange);
    let lastX = firstX;

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(firstX, padding.top + graphHeight);

    let lastY = padding.top + graphHeight;
    points.forEach((point) => {
      const x = this.xForTime(point.time, layout, visibleRange);
      const yValue = ((point[seriesKey] ?? 0) / this.currentMaxY) * graphHeight * this.options.areaHeightFactor;
      const y = padding.top + graphHeight - yValue;
      ctx.lineTo(x, lastY);
      ctx.lineTo(x, y);
      lastY = y;
      lastX = x;
    });

    ctx.lineTo(lastX, lastY);
    ctx.lineTo(lastX, padding.top + graphHeight);
    ctx.closePath();
    ctx.fill();
  }

  private drawTimeoutRanges(points: BandwidthPoint[], layout: Layout, visibleRange: TimeRange): void {
    const { padding, graphHeight } = layout;
    if (points.length === 0) return;

    const ctx = this.ctx;
    const graphLeft = padding.left;
    const graphRight = padding.left + layout.graphWidth;

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
      const startTime = this.getPointBandStart(points, rangeStartIndex, visibleRange);
      const endTime = this.getPointBandEnd(points, rangeEndIndex, visibleRange);
      const startX = this.xForTime(startTime, layout, visibleRange);
      const endX = this.xForTime(endTime, layout, visibleRange);
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

  private drawSummary(layout: Layout, visiblePoints: BandwidthPoint[]): void {
    if (!this.options.legend.visible) return;

    const inboundStats = calculateStats(visiblePoints.map((point) => point.inboundBps));
    const outboundStats = calculateStats(visiblePoints.map((point) => point.outboundBps));
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
    if (this.isPanning || !this.options.interaction.tooltip) return;

    const layout = this.createLayout();
    const visibleRange = this.getVisibleTimeRange();
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { padding } = layout;

    const inside = x > padding.left && x < layout.width - padding.right && y > padding.top && y < layout.height - padding.bottom;
    if (!inside) {
      this.handleMouseOut();
      return;
    }

    const visiblePoints = this.getVisiblePoints(visibleRange);
    const point = this.findNearestPointByX(x, visiblePoints, layout, visibleRange);
    if (!point) return;

    const pointX = this.xForTime(point.time, layout, visibleRange);
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
    this.drawGraph(pointX);
  }

  private handleMouseOut(): void {
    if (this.isPanning) return;
    this.tooltip.style.display = "none";
    this.render();
  }

  private handleWheel(event: WheelEvent): void {
    if (!this.options.interaction.wheelZoom) return;

    const layout = this.createLayout();
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { padding } = layout;
    const inside = x > padding.left && x < layout.width - padding.right && y > padding.top && y < layout.height - padding.bottom;
    if (!inside) return;

    event.preventDefault();
    const visibleRange = this.getVisibleTimeRange();
    const anchorTime = this.timeForX(x, layout, visibleRange);
    this.zoom(event.deltaY > 0 ? 1.2 : 0.82, anchorTime);
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.options.interaction.dragPan || event.button !== 0) return;

    const layout = this.createLayout();
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { padding } = layout;
    const inside = x > padding.left && x < layout.width - padding.right && y > padding.top && y < layout.height - padding.bottom;
    if (!inside) return;

    this.isPanning = true;
    this.panStartX = x;
    this.panStartRange = this.getVisibleTimeRange();
    this.tooltip.style.display = "none";
    this.canvas.style.cursor = "grabbing";
  }

  private handleWindowMouseMove(event: MouseEvent): void {
    if (!this.isPanning || !this.panStartRange) return;

    const layout = this.createLayout();
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const duration = this.panStartRange.endTime - this.panStartRange.startTime;
    const deltaX = x - this.panStartX;
    const deltaTime = -(deltaX / layout.graphWidth) * duration;

    this.range = this.rangeFromTimeRange(this.clampTimeRange(this.panStartRange.startTime + deltaTime, this.panStartRange.endTime + deltaTime));
    this.followLive = false;
    if (this.options.scale.autoScale) this.updateAutoScale();
    this.render();
  }

  private handleWindowMouseUp(): void {
    if (!this.isPanning) return;
    this.isPanning = false;
    this.panStartRange = null;
    this.canvas.style.cursor = "";
  }

  private updateAutoScale(): void {
    const visiblePoints = this.getVisiblePoints(this.getVisibleTimeRange());
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

  private getVisiblePoints(range = this.getVisibleTimeRange()): BandwidthPoint[] {
    return this.points.filter((point) => {
      const time = toTime(point.time);
      return time >= range.startTime && time <= range.endTime;
    });
  }

  private getVisibleTimeRange(): TimeRange {
    if (this.range) {
      return {
        startTime: toTime(this.range.start),
        endTime: toTime(this.range.end),
      };
    }

    const dataRange = this.getDataTimeRange();
    if (!dataRange) {
      const endTime = Date.now();
      return {
        startTime: endTime - this.getDefaultLiveDurationMs(),
        endTime,
      };
    }

    if (this.dataMode === "history" || !this.followLive) {
      return dataRange;
    }

    const endTime = dataRange.endTime;
    return {
      startTime: endTime - this.getDefaultLiveDurationMs(),
      endTime,
    };
  }

  private getDataTimeRange(): TimeRange | null {
    if (this.points.length === 0) return null;

    return {
      startTime: toTime(this.points[0].time),
      endTime: toTime(this.points[this.points.length - 1].time),
    };
  }

  private getDefaultLiveDurationMs(): number {
    return this.options.maxDataPoints * this.options.intervalSeconds * 1000;
  }

  private clampRangeDuration(duration: number): number {
    const minRangeMs = this.options.interaction.minRangeMs;
    const maxRangeMs = this.options.interaction.maxRangeMs;
    let nextDuration = Math.max(minRangeMs, duration);
    if (maxRangeMs) nextDuration = Math.min(maxRangeMs, nextDuration);
    return nextDuration;
  }

  private clampTimeRange(start: number, end: number): TimeRange {
    const normalizedStart = Math.min(start, end);
    const normalizedEnd = Math.max(start, end);
    const dataRange = this.getDataTimeRange();

    if (!dataRange) {
      return {
        startTime: normalizedStart,
        endTime: normalizedEnd,
      };
    }

    const dataDuration = dataRange.endTime - dataRange.startTime;
    const requestedDuration = normalizedEnd - normalizedStart;

    if (dataDuration <= 0 || requestedDuration >= dataDuration) {
      return dataRange;
    }

    let startTime = normalizedStart;
    let endTime = normalizedEnd;

    if (startTime < dataRange.startTime) {
      startTime = dataRange.startTime;
      endTime = startTime + requestedDuration;
    }

    if (endTime > dataRange.endTime) {
      endTime = dataRange.endTime;
      startTime = endTime - requestedDuration;
    }

    return { startTime, endTime };
  }

  private rangeFromTimeRange(range: TimeRange): BandwidthRange {
    return {
      start: range.startTime,
      end: range.endTime,
    };
  }

  private xForTime(value: Date | number | string, layout: Layout, range: TimeRange): number {
    const duration = Math.max(1, range.endTime - range.startTime);
    const ratio = (toTime(value) - range.startTime) / duration;
    return layout.padding.left + ratio * layout.graphWidth;
  }

  private timeForX(x: number, layout: Layout, range: TimeRange): number {
    const ratio = (x - layout.padding.left) / layout.graphWidth;
    return range.startTime + ratio * (range.endTime - range.startTime);
  }

  private findNearestPointByX(x: number, points: BandwidthPoint[], layout: Layout, range: TimeRange): BandwidthPoint | null {
    let nearestPoint: BandwidthPoint | null = null;
    let nearestDistance = Infinity;

    for (const point of points) {
      const pointX = this.xForTime(point.time, layout, range);
      const distance = Math.abs(pointX - x);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = point;
      }
    }

    return nearestPoint;
  }

  private getPointBandStart(points: BandwidthPoint[], index: number, range: TimeRange): number {
    const currentTime = toTime(points[index].time);
    const previousPoint = points[index - 1];
    const nextPoint = points[index + 1];

    if (previousPoint) return Math.max(range.startTime, midpoint(toTime(previousPoint.time), currentTime));
    if (nextPoint) return Math.max(range.startTime, currentTime - (toTime(nextPoint.time) - currentTime) / 2);
    return range.startTime;
  }

  private getPointBandEnd(points: BandwidthPoint[], index: number, range: TimeRange): number {
    const currentTime = toTime(points[index].time);
    const nextPoint = points[index + 1];
    const previousPoint = points[index - 1];

    if (nextPoint) return Math.min(range.endTime, midpoint(currentTime, toTime(nextPoint.time)));
    if (previousPoint) return Math.min(range.endTime, currentTime + (currentTime - toTime(previousPoint.time)) / 2);
    return range.endTime;
  }

  private formatBps(value: number | null | undefined): string {
    return value !== null && value !== undefined && this.options.yAxisFormatter
      ? this.options.yAxisFormatter(value)
      : formatBps(value);
  }

  private trimLiveBuffer(): void {
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

function comparePointTime(a: BandwidthPoint, b: BandwidthPoint): number {
  return toTime(a.time) - toTime(b.time);
}

function isTimeoutPoint(point: BandwidthPoint): boolean {
  return point.status === "timeout" || point.status === "error" || point.inboundBps === null || point.outboundBps === null;
}

function midpoint(a: number, b: number): number {
  return a + (b - a) / 2;
}

function toTime(value: Date | number | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
