import { Color, ImageSource } from '@nativescript/core';
import { BarChart } from '@nativescript-community/ui-chart/charts';
import { BarData } from '@nativescript-community/ui-chart/data/BarData';
import { BarDataSet } from '@nativescript-community/ui-chart/data/BarDataSet';

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomColor() {
    const r = getRandomInt(0, 255);
    const g = getRandomInt(0, 255);
    const b = getRandomInt(0, 255);
    return new Color(255, r, g, b);
}

export function onNavigatedTo(args) {
    const page = args.object;
    page.bindingContext = args.context;
}

export function onChartLoaded(args) {
    const chart = args.object as BarChart;

    chart.drawFrameRate = true;
    // chart.setLogEnabled(true);
    chart.setScaleEnabled(true);
    chart.setDragEnabled(true);
    chart.setHighlightPerTapEnabled(true);
    // chart.setHardwareAccelerationEnabled(true);

    const icon = ImageSource.fromFileOrResourceSync('~/assets/star.png');

    const data = new Array(5).fill(0).map(function (v, i) {
        return { index: i, value: Math.random() * 1, icon };
    });

    const sets = [];
    const set = new BarDataSet(data, 'Dataset Label', 'index', 'value');
    set.setDrawIcons(true);
    set.setColor(getRandomColor());
    set.setDrawValues(true);
    sets.push(set);

    // Create a data object with the data sets
    const bd = new BarData(sets);

    // Set data
    chart.setData(bd);
}

export function redraw(args) {
    const page = args.object.page;

    const chart = page.getViewById('chart');
    if (chart) {
        chart.invalidate();
    }
}

export function onNavigationButtonTap(args) {
    args.object.page.frame.goBack();
}
