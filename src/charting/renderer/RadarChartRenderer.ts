import { Canvas, Direction, Paint, Path, Style, TypedArray } from '@nativescript-community/ui-canvas';
import { Color } from '@nativescript/core';
import { ChartAnimator } from '../animation/ChartAnimator';
import { RadarChart } from '../charts/RadarChart';
import { Highlight } from '../highlight/Highlight';
import { IRadarDataSet } from '../interfaces/datasets/IRadarDataSet';
import { ColorTemplate } from '../utils/ColorTemplate';
import { MPPointF } from '../utils/MPPointF';
import { Utils } from '../utils/Utils';
import { ViewPortHandler } from '../utils/ViewPortHandler';
import { LineRadarRenderer } from './LineRadarRenderer';

export class RadarChartRenderer extends LineRadarRenderer {
    protected mChart: RadarChart;

    /**
     * palet for drawing the web
     */
    protected mWebPaint: Paint;

    private mLineBuffer: TypedArray;

    constructor(chart: RadarChart, animator: ChartAnimator, viewPortHandler: ViewPortHandler) {
        super(animator, viewPortHandler);
        this.mChart = chart;
    }

    public get highlightPaint() {
        if (!this.mHighlightPaint) {
            this.mHighlightPaint = Utils.getTemplatePaint('black-stroke');
            this.mHighlightPaint.setStrokeWidth(2);
            this.mHighlightPaint.setColor(new Color(255, 255, 187, 115));
        }
        return this.mHighlightPaint;
    }
    public get webPaint() {
        if (!this.mWebPaint) {
            this.mWebPaint = Utils.getTemplatePaint('black-stroke');
        }
        return this.mWebPaint;
    }

    public drawData(c: Canvas) {
        const radarData = this.mChart.getData();
        const mostEntries = radarData.getMaxEntryCountSet().getEntryCount();

        for (const set of radarData.getDataSets()) {
            if (set.isVisible()) {
                this.drawDataSet(c, set, mostEntries);
            }
        }
    }

    /**
     * Draws the RadarDataSet
     *
     * @param c
     * @param dataSet
     * @param mostEntries the entry count of the dataset with the most entries
     */
    protected drawDataSet(c: Canvas, dataSet: IRadarDataSet, mostEntries) {
        const phaseX = this.mAnimator.getPhaseX();
        const phaseY = this.mAnimator.getPhaseY();

        const sliceangle = this.mChart.getSliceAngle();

        // calculate the factor that is needed for transforming the value to
        // pixels
        const factor = this.mChart.getFactor();

        const center = this.mChart.getCenterOffsets();
        const pOut: MPPointF = { x: 0, y: 0 };
        const surface = Utils.getTempPath();
        surface.reset();

        let hasMovedToPoint = false;
        const minVal = this.mChart.getYChartMin();
        const angle = this.mChart.getRotationAngle();

        const entryCount = dataSet.getEntryCount();
        if (!this.mLineBuffer || this.mLineBuffer.length < Math.max(entryCount * 2, 2) * 2) {
            this.mLineBuffer = Utils.createArrayBuffer(Math.max(entryCount * 2, 2) * 2);
        }
        const float32arr = this.mLineBuffer;
        let index = 0;
        for (let j = 0; j < dataSet.getEntryCount(); j++) {
            const e = dataSet.getEntryForIndex(j);
            const yProperty = dataSet.yProperty;

            Utils.getPosition(center, (e[yProperty] - minVal) * factor * phaseY, sliceangle * j * phaseX + angle, pOut);

            if (isNaN(pOut.x)) continue;

            if (!hasMovedToPoint) {
                float32arr[index++] = pOut.x;
                float32arr[index++] = pOut.y;
                hasMovedToPoint = true;
            }

            float32arr[index++] = pOut.x;
            float32arr[index++] = pOut.y;
        }

        if (dataSet.getEntryCount() > mostEntries) {
            // if this is not the largest set, draw a line to the center before closing
            float32arr[index++] = center.x;
            float32arr[index++] = center.y;
        }
        float32arr[index++] = float32arr[0];
        float32arr[index++] = float32arr[1];
        const points = Utils.pointsFromBuffer(float32arr);
        if (__ANDROID__ && Utils.supportsDirectArrayBuffers()) {
            surface['setLinesBuffer'](points, 0, index);
        } else {
            surface.setLines(points as number[], 0, index);
        }

        // surface.close();

        if (dataSet.isDrawFilledEnabled()) {
            const renderPaint = this.renderPaint;
            const previousShader = renderPaint.getShader();
            const shader = dataSet.getFillShader();
            if (shader) {
                renderPaint.setShader(shader);
            }
            const drawable = dataSet.getFillDrawable();
            if (drawable != null) {
                this.drawFilledPathBitmap(c, surface, drawable, dataSet.getFillShader());
            } else {
                this.drawFilledPath(c, surface, dataSet.getFillColor(), dataSet.getFillAlpha());
            }
            renderPaint.setShader(previousShader);
        }

        // draw the line (only if filled is disabled or alpha is below 255)
        const lineWidth = dataSet.getLineWidth();
        if ((!dataSet.isDrawFilledEnabled() || dataSet.getFillAlpha() < 255) && lineWidth > 0) {
            const renderPaint = this.renderPaint;
            renderPaint.setColor(dataSet.getColor());
            renderPaint.setStrokeWidth(lineWidth);
            renderPaint.setStyle(Style.STROKE);
            c.drawPath(surface, renderPaint);
        }
        // MPPointF.recycleInstance(center);
        // MPPointF.recycleInstance(pOut);
    }

    public drawValues(c: Canvas) {
        const data = this.mChart.getData();
        const dataSets = data.getDataSets();
        if (dataSets.some((d) => d.isDrawValuesEnabled() || d.isDrawIconsEnabled()) === false) {
            return;
        }
        const phaseX = this.mAnimator.getPhaseX();
        const phaseY = this.mAnimator.getPhaseY();

        const sliceangle = this.mChart.getSliceAngle();

        // calculate the factor that is needed for transforming the value to
        // pixels
        const factor = this.mChart.getFactor();

        const center = this.mChart.getCenterOffsets();
        const pOut: MPPointF = { x: 0, y: 0 };
        const pIcon: MPPointF = { x: 0, y: 0 };

        const yoffset = 5;
        const customRender = this.mChart.getCustomRenderer();
        for (let i = 0; i < data.getDataSetCount(); i++) {
            const dataSet = data.getDataSetByIndex(i);
            if (!this.shouldDrawValues(dataSet) || dataSet.getEntryCount() < 1) continue;

            const drawValues = dataSet.isDrawValuesEnabled();
            const drawIcons = dataSet.isDrawIconsEnabled();
            if (!drawValues && !drawIcons) {
                continue;
            }
            const yProperty = dataSet.yProperty;

            if (!this.shouldDrawValues(dataSet)) continue;

            // apply the text-styling defined by the DataSet
            this.applyValueTextStyle(dataSet);

            const formatter = dataSet.getValueFormatter();

            const iconsOffset = dataSet.getIconsOffset();
            const valuesOffset = dataSet.getValuesOffset();
            const paint = this.valuePaint;
            for (let j = 0; j < dataSet.getEntryCount(); j++) {
                const entry = dataSet.getEntryForIndex(j);

                Utils.getPosition(center, (entry[yProperty] - this.mChart.getYChartMin()) * factor * phaseY, sliceangle * j * phaseX + this.mChart.getRotationAngle(), pOut);

                if (drawValues) {
                    this.drawValue(c, formatter.getRadarLabel(entry[yProperty], entry), pOut.x + valuesOffset.x, pOut.y + valuesOffset.y - yoffset, dataSet.getValueTextColor(j), paint, customRender);
                }

                if (drawIcons && entry.icon != null) {
                    const icon = entry.icon;

                    Utils.getPosition(center, entry[yProperty] * factor * phaseY + iconsOffset.y, sliceangle * j * phaseX + this.mChart.getRotationAngle(), pIcon);

                    //noinspection SuspiciousNameCombination
                    pIcon.y += iconsOffset.x;

                    Utils.drawIcon(c, this.mChart, icon, pIcon.x, pIcon.y);
                }
            }

            // MPPointF.recycleInstance(iconsOffset);
        }

        // MPPointF.recycleInstance(center);
        // MPPointF.recycleInstance(pOut);
        // MPPointF.recycleInstance(pIcon);
    }

    public drawExtras(c: Canvas) {
        this.drawWeb(c);
    }

    protected drawWeb(c: Canvas) {
        const sliceangle = this.mChart.getSliceAngle();

        // calculate the factor that is needed for transforming the value to
        // pixels
        const factor = this.mChart.getFactor();
        const rotationangle = this.mChart.getRotationAngle();

        const center = this.mChart.getCenterOffsets();

        // draw the web lines that come from the center
        const lineWidth = this.mChart.getWebLineWidth();
        if (lineWidth > 0) {
            const paint = this.webPaint;
            paint.setStrokeWidth(this.mChart.getWebLineWidth());
            paint.setColor(this.mChart.getWebColor());
            paint.setAlpha(this.mChart.getWebAlpha());

            const xIncrements = 1 + this.mChart.getSkipWebLineCount();
            const maxEntryCount = this.mChart.getData().getMaxEntryCountSet().getEntryCount();

            const p: MPPointF = { x: 0, y: 0 };
            for (let i = 0; i < maxEntryCount; i += xIncrements) {
                Utils.getPosition(center, this.mChart.getYRange() * factor, sliceangle * i + rotationangle, p);

                c.drawLine(center.x, center.y, p.x, p.y, paint);
            }
        }

        // MPPointF.recycleInstance(p);

        // draw the inner-web
        const innerWidth = this.mChart.getWebLineWidthInner();
        if (innerWidth > 0) {
            const paint = this.webPaint;
            paint.setStrokeWidth(this.mChart.getWebLineWidthInner());
            paint.setColor(this.mChart.getWebColorInner());
            paint.setAlpha(this.mChart.getWebAlpha());

            const labelCount = this.mChart.getYAxis().mEntryCount;

            const p1out: MPPointF = { x: 0, y: 0 };
            const p2out: MPPointF = { x: 0, y: 0 };
            for (let j = 0; j < labelCount; j++) {
                for (let i = 0; i < this.mChart.getData().getEntryCount(); i++) {
                    const r = (this.mChart.getYAxis().mEntries[j] - this.mChart.getYChartMin()) * factor;

                    Utils.getPosition(center, r, sliceangle * i + rotationangle, p1out);
                    Utils.getPosition(center, r, sliceangle * (i + 1) + rotationangle, p2out);

                    c.drawLine(p1out.x, p1out.y, p2out.x, p2out.y, this.mWebPaint);
                }
            }
        }

        // MPPointF.recycleInstance(p1out);
        // MPPointF.recycleInstance(p2out);
    }

    public drawHighlighted(c: Canvas, indices: Highlight[]) {
        const sliceangle = this.mChart.getSliceAngle();

        // calculate the factor that is needed for transforming the value to
        // pixels
        const factor = this.mChart.getFactor();

        const center = this.mChart.getCenterOffsets();
        const pOut: MPPointF = { x: 0, y: 0 };

        const radarData = this.mChart.getData();

        for (const high of indices) {
            const set = radarData.getDataSetByIndex(high.dataSetIndex);
            const yProperty = set.yProperty;

            if (set == null || !set.isHighlightEnabled()) continue;

            const e = set.getEntryForIndex(high.x);

            if (!this.isInBoundsX(e, set)) continue;

            const y = e[yProperty] - this.mChart.getYChartMin();

            Utils.getPosition(center, y * factor * this.mAnimator.getPhaseY(), sliceangle * high.x * this.mAnimator.getPhaseX() + this.mChart.getRotationAngle(), pOut);

            high.drawX = pOut.x;
            high.drawY = pOut.y;

            // draw the lines
            this.drawHighlightLines(c, pOut.x, pOut.y, set);

            if (set.isDrawHighlightCircleEnabled()) {
                if (!isNaN(pOut.x) && !isNaN(pOut.y)) {
                    let strokeColor = set.getHighlightCircleStrokeColor();
                    if (strokeColor === ColorTemplate.COLOR_NONE) {
                        strokeColor = set.getColor(0);
                    }

                    if (set.getHighlightCircleStrokeAlpha() < 255) {
                        strokeColor = ColorTemplate.colorWithAlpha(strokeColor instanceof Color ? strokeColor : new Color(strokeColor), set.getHighlightCircleStrokeAlpha());
                    }

                    this.drawHighlightCircle(
                        c,
                        pOut,
                        set.getHighlightCircleInnerRadius(),
                        set.getHighlightCircleOuterRadius(),
                        set.getHighlightCircleFillColor(),
                        strokeColor,
                        set.getHighlightCircleStrokeWidth()
                    );
                }
            }
        }

        // MPPointF.recycleInstance(center);
        // MPPointF.recycleInstance(pOut);
    }

    public drawHighlightCircle(c: Canvas, point: MPPointF, innerRadius, outerRadius, fillColor, strokeColor, strokeWidth) {
        c.save();

        const paint  = Utils.getTempPaint();
        if (fillColor && fillColor !== ColorTemplate.COLOR_NONE) {
            const p = Utils.getTempPath();
            p.reset();
            p.addCircle(point.x, point.y, outerRadius, Direction.CW);
            if (innerRadius > 0) {
                p.addCircle(point.x, point.y, innerRadius, Direction.CCW);
            }
            paint.setColor(fillColor);
            paint.setStyle(Style.FILL);
            c.drawPath(p, paint);
        }

        if (strokeColor && strokeColor !== ColorTemplate.COLOR_NONE) {
            paint.setColor(strokeColor);
            paint.setStyle(Style.STROKE);
            paint.setStrokeWidth(strokeWidth);
            c.drawCircle(point.x, point.y, outerRadius, paint);
        }

        c.restore();
    }
}
