import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";

const theme = getComputedStyle(document.documentElement);
const colors = Object.fromEntries(
    ["text-primary", "app-background", "chart-weight", "chart-systolic", "chart-diastolic", "chart-grid"]
        .map((name) => [name, theme.getPropertyValue(`--${name}`).trim()])
);

const rawReadings = [
    ["2026-03-09T08:15:00", 147.2, 139, 87],
    ["2026-03-12T17:30:00", 146.8, 137, 85],
    ["2026-03-18T07:45:00", 146.1, 135, 84],
    ["2026-03-24T18:20:00", 145.7, 134, 83],
    ["2026-03-30T08:40:00", 145.2, 136, 85],
    ["2026-04-05T09:10:00", 144.9, 132, 82],
    ["2026-04-11T17:55:00", 144.5, 131, 81],
    ["2026-04-17T08:05:00", 144.1, 129, 80],
    ["2026-04-23T18:35:00", 143.8, 128, 80],
    ["2026-04-29T07:50:00", 143.5, 127, 79],
    ["2026-05-01T08:15:00", 143.4, 129, 80],
    ["2026-05-01T18:30:00", 143.2, 126, 78],
    ["2026-05-02T09:00:00", 143.1, 128, 80],
    ["2026-05-03T08:20:00", 143.0, 127, 79],
    ["2026-05-03T17:40:00", 142.9, 125, 78],
    ["2026-05-04T07:35:00", 142.7, 126, 79],
    ["2026-05-05T07:30:00", 142.6, 132, 84],
    ["2026-05-06T08:10:00", 142.3, 125, 79],
    ["2026-05-07T16:25:00", 142.0, 120, 76]
].map(([time, weight, systolic, diastolic]) => ({
    time: new Date(time).getTime(),
    weight,
    systolic,
    diastolic
}));

const rawWeightReadings = rawReadings.map(({ time, weight }) => ({ time, weight }));
const rawBloodPressureReadings = [
    ...rawReadings
        .filter(({ time }) => time !== new Date("2026-05-05T07:30:00").getTime())
        .map(({ time, systolic, diastolic }) => ({ time, systolic, diastolic })),
    { time: new Date("2026-05-05T18:45:00").getTime(), systolic: 128, diastolic: 82 },
    { time: new Date("2026-05-06T19:20:00").getTime(), systolic: 130, diastolic: 81 },
    { time: new Date("2026-05-08T08:15:00").getTime(), systolic: 140, diastolic: 96 }
].sort((a, b) => a.time - b.time);

const rangeSettings = {
    "4d": {
        min: "2026-05-05T00:00:00",
        max: "2026-05-08T23:59:59",
        unit: "day",
        maxTicks: 4,
        note: ""
    },
    "1w": {
        min: "2026-05-02T00:00:00",
        max: "2026-05-08T23:59:59",
        unit: "day",
        maxTicks: 7,
        note: "Measurements averaged by day",
        missingWeightDate: "2026-05-08T12:00:00"
    },
    "2m": {
        min: "2026-03-08T00:00:00",
        max: "2026-05-08T23:59:59",
        unit: "week",
        maxTicks: 5,
        note: "Measurements averaged by week",
        showWeekRange: true
    }
};

const dayKey = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const weekKey = (timestamp) => {
    const date = new Date(timestamp);
    const daysSinceMonday = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - daysSinceMonday);
    date.setHours(12, 0, 0, 0);
    return dayKey(date.getTime());
};

const averageReadings = (readings, keyForReading) => {
    const groups = new Map();

    readings.forEach((reading) => {
        const key = keyForReading(reading.time);
        const group = groups.get(key) ?? [];
        group.push(reading);
        groups.set(key, group);
    });

    return [...groups.entries()].map(([key, group]) => {
        const fields = Object.keys(group[0]).filter((field) => field !== "time");
        const averaged = { time: new Date(`${key}T12:00:00`).getTime() };

        fields.forEach((field) => {
            const average = group.reduce((sum, reading) => sum + reading[field], 0) / group.length;
            averaged[field] = field === "weight"
                ? Math.round(average * 10) / 10
                : Math.round(average);
        });

        return averaged;
    }).sort((a, b) => a.time - b.time);
};

const getReadings = (range, measurement) => {
    const settings = rangeSettings[range];
    const min = new Date(settings.min).getTime();
    const max = new Date(settings.max).getTime();
    const source = measurement === "weight" ? rawWeightReadings : rawBloodPressureReadings;
    const readings = source.filter(({ time }) => time >= min && time <= max);

    if (range === "1w") return averageReadings(readings, dayKey);
    if (range === "2m") return averageReadings(readings, weekKey);
    return readings;
};

const toWeightData = (readings) =>
    readings.map(({ time, weight }) => ({ x: time, y: weight }));

const toBloodPressureData = (readings) => ({
    systolic: readings.map(({ time, systolic }) => ({ x: time, y: systolic })),
    diastolic: readings.map(({ time, diastolic }) => ({ x: time, y: diastolic }))
});

const paddedRange = (values, padding, roundTo = 1) => ({
    min: Math.floor((Math.min(...values) - padding) / roundTo) * roundTo,
    max: Math.ceil((Math.max(...values) + padding) / roundTo) * roundTo
});

const getWeightRange = (data) => paddedRange(data.map(({ y }) => y), 1);
const getBloodPressureRange = ({ systolic, diastolic }) =>
    paddedRange([...systolic, ...diastolic].map(({ y }) => y), 8, 10);

const readingConnectors = {
    id: "readingConnectors",
    beforeDatasetsDraw(chart) {
        const topPoints = chart.getDatasetMeta(0).data;
        const bottomPoints = chart.getDatasetMeta(1).data;
        const { ctx } = chart;

        ctx.save();
        ctx.strokeStyle = colors["text-primary"];
        ctx.lineWidth = 2;
        topPoints.forEach((point, index) => {
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(bottomPoints[index].x, bottomPoints[index].y);
            ctx.stroke();
        });
        ctx.restore();
    }
};

const daySeparators = {
    id: "daySeparators",
    beforeDatasetsDraw(chart) {
        if ((chart.$activeRange ?? activeRange) !== "4d") return;

        const { ctx, chartArea, scales } = chart;
        const nextDay = new Date(scales.x.min);
        nextDay.setHours(0, 0, 0, 0);
        nextDay.setDate(nextDay.getDate() + 1);

        ctx.save();
        ctx.strokeStyle = colors["chart-grid"];
        ctx.lineWidth = 1;
        for (let boundary = nextDay.getTime(); boundary < scales.x.max; boundary += 86400000) {
            const x = scales.x.getPixelForValue(boundary);
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.stroke();
        }
        ctx.restore();
    }
};

const valueLabels = {
    id: "valueLabels",
    afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        ctx.save();
        ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
        ctx.textBaseline = "middle";

        chart.data.datasets.forEach((dataset, datasetIndex) => {
            chart.getDatasetMeta(datasetIndex).data.forEach((point, pointIndex) => {
                const value = Number(dataset.data[pointIndex].y).toLocaleString("en-US", { maximumFractionDigits: 1 });
                const textWidth = ctx.measureText(value).width;
                const placeLeft = point.x > chartArea.right - 30;
                const centerX = point.x + (placeLeft ? -(textWidth / 2 + 9) : textWidth / 2 + 9);
                const centerY = point.y + (pointIndex % 2 === 0 ? -7 : 7);

                ctx.fillStyle = colors["app-background"];
                ctx.fillRect(centerX - textWidth / 2 - 3, centerY - 8, textWidth + 6, 16);
                ctx.strokeStyle = colors["chart-grid"];
                ctx.strokeRect(centerX - textWidth / 2 - 3, centerY - 8, textWidth + 6, 16);
                ctx.fillStyle = colors["text-primary"];
                ctx.textAlign = "center";
                ctx.fillText(value, centerX, centerY);
            });
        });
        ctx.restore();
    }
};

const makeTimeScale = (settings) => ({
    type: "time",
    min: new Date(settings.min).getTime(),
    max: new Date(settings.max).getTime(),
    time: {
        unit: settings.unit,
        displayFormats: { day: "MMM d", week: "MMM d" }
    },
    grid: { display: false },
    ticks: {
        color: "rgb(60, 60, 60)",
        font: { family: "Segoe UI", size: 12, weight: "600" },
        maxRotation: 0,
        maxTicksLimit: settings.maxTicks
    }
});

let activeRange = "4d";

const tooltip = {
    callbacks: {
        title: (items) => {
            const timestamp = items[0].parsed.x;
            if (activeRange === "2m") return formatWeekRange(timestamp);

            return new Intl.DateTimeFormat("en-US", activeRange === "4d"
                ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                : { month: "short", day: "numeric" }
            ).format(new Date(timestamp));
        },
        label: ({ dataset, parsed }) => `${dataset.label}: ${parsed.y}`
    }
};

const bloodPressureTooltip = {
    callbacks: {
        ...tooltip.callbacks,
        label: ({ parsed }) => String(parsed.y)
    }
};

const initialSettings = rangeSettings[activeRange];
const initialWeightReadings = getReadings(activeRange, "weight");
const initialBloodPressureReadings = getReadings(activeRange, "blood-pressure");
const initialWeight = toWeightData(initialWeightReadings);
const initialWeightRange = getWeightRange(initialWeight);
const initialBloodPressure = toBloodPressureData(initialBloodPressureReadings);
const initialBloodPressureRange = getBloodPressureRange(initialBloodPressure);

const weightChart = new Chart(document.querySelector("#weight-chart"), {
    type: "line",
    data: {
        datasets: [{
            label: "Weight",
            data: initialWeight,
            borderColor: colors["chart-weight"],
            backgroundColor: colors["chart-weight"],
            borderWidth: 4,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBorderWidth: 3,
            pointBorderColor: colors["chart-weight"],
            pointBackgroundColor: colors["app-background"],
            tension: 0.2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        normalized: true,
        interaction: { mode: "nearest", intersect: false, axis: "x" },
        layout: { padding: { top: 8, right: 24 } },
        plugins: { legend: { display: false }, tooltip },
        scales: {
            x: makeTimeScale(initialSettings),
            y: {
                min: initialWeightRange.min,
                max: initialWeightRange.max,
                grid: { color: colors["chart-grid"] },
                ticks: { color: "rgb(60, 60, 60)", font: { family: "Segoe UI", size: 11 }, stepSize: 1 }
            }
        }
    },
    plugins: [daySeparators, valueLabels]
});

const bloodPressureChart = new Chart(document.querySelector("#blood-pressure-chart"), {
    type: "scatter",
    data: {
        datasets: [
            {
                label: "Systolic",
                data: initialBloodPressure.systolic,
                pointStyle: "circle",
                pointRadius: 6,
                pointHoverRadius: 7,
                backgroundColor: colors["chart-systolic"],
                borderColor: colors["chart-systolic"]
            },
            {
                label: "Diastolic",
                data: initialBloodPressure.diastolic,
                pointStyle: "rect",
                pointRadius: 6,
                pointHoverRadius: 7,
                backgroundColor: colors["chart-diastolic"],
                borderColor: colors["chart-diastolic"]
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        normalized: true,
        interaction: { mode: "index", intersect: false, axis: "x" },
        layout: { padding: { top: 8, right: 24 } },
        plugins: { legend: { display: false }, tooltip: bloodPressureTooltip },
        scales: {
            x: makeTimeScale(initialSettings),
            y: {
                min: initialBloodPressureRange.min,
                max: initialBloodPressureRange.max,
                grid: { color: colors["chart-grid"] },
                ticks: { color: "rgb(60, 60, 60)", font: { family: "Segoe UI", size: 11 }, stepSize: 10 }
            }
        }
    },
    plugins: [daySeparators, readingConnectors, valueLabels]
});

const viewActions = document.querySelectorAll("#prototype .view-action[data-view]");
const rangeActions = document.querySelectorAll("#prototype .chart-range-action");
const tableViews = document.querySelectorAll("#prototype .measurement-table-rows");
const chartViews = document.querySelectorAll("#prototype .measurement-chart");
const aggregationNote = document.querySelector("#prototype .aggregation-note");

const setPressedAction = (actions, activeAction) => {
    actions.forEach((action) => {
        const isActive = action === activeAction;
        action.classList.toggle("is-active", isActive);
        action.setAttribute("aria-pressed", String(isActive));
    });
};

const dateParts = (timestamp) => {
    const parts = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
        .formatToParts(new Date(timestamp));
    return {
        month: parts.find(({ type }) => type === "month").value,
        day: parts.find(({ type }) => type === "day").value
    };
};

const formatTime = (timestamp) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));

const formatWeekRange = (timestamp) => {
    const start = new Date(timestamp);
    const end = new Date(timestamp);
    end.setDate(end.getDate() + 7);
    const startMonth = new Intl.DateTimeFormat("en-US", { month: "short" }).format(start);
    const endMonth = new Intl.DateTimeFormat("en-US", { month: "short" }).format(end);
    const startDay = start.getDate();
    const endDay = end.getDate();

    return startMonth === endMonth
        ? `${startMonth} ${startDay} – ${endDay}`
        : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
};

const tableRow = (reading, measurement, settings) => {
    const { month, day } = dateParts(reading.time);
    const machineDate = new Date(reading.time).toISOString();
    const dateColumn = settings.showWeekRange
        ? `<span class="measurement-date-range normal-text">${formatWeekRange(reading.time)}</span>`
        : `<time class="measurement-date" datetime="${machineDate}">
                <span class="normal-text">${month}</span>
                <span class="measurement-primary">${day}</span>
           </time>`;
    const isAveraged = Boolean(settings.note);
    const middleColumn = isAveraged
        ? ""
        : `<div class="measurement-detail"><time class="measurement-time normal-text" datetime="${machineDate}">${formatTime(reading.time)}</time></div>`;
    const valueColumn = measurement === "weight"
        ? `<span class="measurement-primary">${reading.weight === null ? "--" : reading.weight.toFixed(1)}</span>`
        : reading.systolic === null
            ? `<span class="measurement-primary">--</span>`
            : `<div class="blood-pressure-reading">
                <span class="blood-pressure-value"><span class="measurement-primary">${reading.systolic}</span></span>
                <span class="blood-pressure-separator" aria-hidden="true"></span>
                <span class="blood-pressure-value"><span class="measurement-primary">${reading.diastolic}</span></span>
           </div>`;

    return `<div class="measurement-details${isAveraged ? " measurement-details--averaged" : ""}${settings.showWeekRange ? " measurement-details--date-range" : ""}">
        <div class="measurement-detail">${dateColumn}</div>
        ${middleColumn}
        <div class="measurement-detail">${valueColumn}</div>
    </div>`;
};

const renderTables = (weightReadings, bloodPressureReadings, settings) => {
    const tableWeightReadings = settings.missingWeightDate
        ? [...weightReadings, { time: new Date(settings.missingWeightDate).getTime(), weight: null }]
        : weightReadings;

    document.querySelector('[data-measurement-table="weight"]').innerHTML =
        [...tableWeightReadings].reverse().map((reading) => tableRow(reading, "weight", settings)).join("");
    document.querySelector('[data-measurement-table="blood-pressure"]').innerHTML =
        [...bloodPressureReadings].reverse().map((reading) => tableRow(reading, "blood-pressure", settings)).join("");
};

const updateTimeScale = (chart, settings) => {
    chart.options.scales.x.min = new Date(settings.min).getTime();
    chart.options.scales.x.max = new Date(settings.max).getTime();
    chart.options.scales.x.time.unit = settings.unit;
    chart.options.scales.x.ticks.maxTicksLimit = settings.maxTicks;
};

const updateData = (range) => {
    activeRange = range;
    const settings = rangeSettings[range];
    const weightReadings = getReadings(range, "weight");
    const bloodPressureReadings = getReadings(range, "blood-pressure");
    const weightData = toWeightData(weightReadings);
    const weightYRange = getWeightRange(weightData);
    const bloodPressureData = toBloodPressureData(bloodPressureReadings);
    const bloodPressureYRange = getBloodPressureRange(bloodPressureData);

    renderTables(weightReadings, bloodPressureReadings, settings);
    aggregationNote.textContent = settings.note;
    aggregationNote.hidden = !settings.note;

    weightChart.data.datasets[0].data = weightData;
    updateTimeScale(weightChart, settings);
    weightChart.options.scales.y.min = weightYRange.min;
    weightChart.options.scales.y.max = weightYRange.max;
    weightChart.update();

    bloodPressureChart.data.datasets[0].data = bloodPressureData.systolic;
    bloodPressureChart.data.datasets[1].data = bloodPressureData.diastolic;
    updateTimeScale(bloodPressureChart, settings);
    bloodPressureChart.options.scales.y.min = bloodPressureYRange.min;
    bloodPressureChart.options.scales.y.max = bloodPressureYRange.max;
    bloodPressureChart.update();
};

viewActions.forEach((action) => {
    action.addEventListener("click", () => {
        const showGraphs = action.dataset.view === "graph";
        setPressedAction(viewActions, action);
        tableViews.forEach((view) => { view.hidden = showGraphs; });
        chartViews.forEach((view) => { view.hidden = !showGraphs; });

        if (showGraphs) {
            requestAnimationFrame(() => {
                weightChart.resize();
                bloodPressureChart.resize();
            });
        }
    });
});

rangeActions.forEach((action) => {
    action.addEventListener("click", () => {
        setPressedAction(rangeActions, action);
        updateData(action.dataset.range);
    });
});

renderTables(initialWeightReadings, initialBloodPressureReadings, initialSettings);

const noRecentRoot = document.querySelector('[data-prototype="no-recent"]');

if (noRecentRoot) {
    let selectedRange = "4d";
    const noRecentWeightReadings = [
        ...rawWeightReadings.filter(({ time }) => time <= new Date("2026-04-23T23:59:59").getTime()),
        { time: new Date("2026-04-24T08:30:00").getTime(), weight: 143.7 }
    ];
    const noRecentBloodPressureReadings = [
        ...rawBloodPressureReadings.filter(({ time }) => time <= new Date("2026-04-23T23:59:59").getTime()),
        { time: new Date("2026-04-24T08:30:00").getTime(), systolic: 128, diastolic: 80 }
    ];

    const stateTooltip = {
        callbacks: {
            title: (items) => selectedRange === "2m"
                ? formatWeekRange(items[0].parsed.x)
                : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
                    .format(new Date(items[0].parsed.x)),
            label: ({ parsed }) => String(parsed.y)
        }
    };

    const makeStateOptions = (settings, min, max, stepSize) => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        normalized: true,
        interaction: { mode: "nearest", intersect: false, axis: "x" },
        layout: { padding: { top: 8, right: 24 } },
        plugins: { legend: { display: false }, tooltip: stateTooltip },
        scales: {
            x: makeTimeScale(settings),
            y: {
                min,
                max,
                grid: { color: colors["chart-grid"] },
                ticks: {
                    color: "rgb(60, 60, 60)",
                    font: { family: "Segoe UI", size: 11 },
                    stepSize
                }
            }
        }
    });

    const stateWeightChart = new Chart(noRecentRoot.querySelector('[data-chart="weight"]'), {
        type: "line",
        data: {
            datasets: [{
                label: "Weight",
                data: [],
                borderColor: colors["chart-weight"],
                backgroundColor: colors["chart-weight"],
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBorderWidth: 3,
                pointBorderColor: colors["chart-weight"],
                pointBackgroundColor: colors["app-background"],
                tension: 0.2
            }]
        },
        options: makeStateOptions(rangeSettings["4d"], 140, 150, 1),
        plugins: [daySeparators, valueLabels]
    });

    const stateBloodPressureChart = new Chart(noRecentRoot.querySelector('[data-chart="blood-pressure"]'), {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Systolic",
                    data: [],
                    pointStyle: "circle",
                    pointRadius: 6,
                    pointHoverRadius: 7,
                    backgroundColor: colors["chart-systolic"],
                    borderColor: colors["chart-systolic"]
                },
                {
                    label: "Diastolic",
                    data: [],
                    pointStyle: "rect",
                    pointRadius: 6,
                    pointHoverRadius: 7,
                    backgroundColor: colors["chart-diastolic"],
                    borderColor: colors["chart-diastolic"]
                }
            ]
        },
        options: makeStateOptions(rangeSettings["4d"], 70, 150, 10),
        plugins: [daySeparators, readingConnectors, valueLabels]
    });

    stateWeightChart.$activeRange = selectedRange;
    stateBloodPressureChart.$activeRange = selectedRange;

    const emptyDailyRows = (measurement) => Array.from({ length: 7 }, (_, index) => ({
        time: new Date(2026, 4, 2 + index, 12).getTime(),
        ...(measurement === "weight"
            ? { weight: null }
            : { systolic: null, diastolic: null })
    }));

    const fillWeeklyRows = (readings, measurement) => {
        const readingsByWeek = new Map(readings.map((reading) => [dayKey(reading.time), reading]));
        const rows = [];

        for (
            let time = new Date("2026-03-09T12:00:00").getTime();
            time <= new Date("2026-05-04T12:00:00").getTime();
            time += 7 * 86400000
        ) {
            rows.push(readingsByWeek.get(dayKey(time)) ?? {
                time,
                ...(measurement === "weight"
                    ? { weight: null }
                    : { systolic: null, diastolic: null })
            });
        }

        return rows;
    };

    const stateTables = {
        weight: noRecentRoot.querySelector('[data-measurement-table="weight"]'),
        bloodPressure: noRecentRoot.querySelector('[data-measurement-table="blood-pressure"]')
    };
    const stateNote = noRecentRoot.querySelector(".aggregation-note");

    const stateReadings = (range, measurement) => {
        if (range !== "2m") return [];
        const source = measurement === "weight"
            ? noRecentWeightReadings
            : noRecentBloodPressureReadings;
        return averageReadings(source, weekKey);
    };

    const renderState = (range) => {
        selectedRange = range;
        const settings = rangeSettings[range];
        const weightReadings = stateReadings(range, "weight");
        const bloodPressureReadings = stateReadings(range, "blood-pressure");

        stateNote.textContent = settings.note;
        stateNote.hidden = !settings.note;

        if (range === "4d") {
            const message = '<p class="no-measurements-message">No measurements to report</p>';
            stateTables.weight.innerHTML = message;
            stateTables.bloodPressure.innerHTML = message;
        } else {
            const weightRows = range === "1w"
                ? emptyDailyRows("weight")
                : fillWeeklyRows(weightReadings, "weight");
            const bloodPressureRows = range === "1w"
                ? emptyDailyRows("blood-pressure")
                : fillWeeklyRows(bloodPressureReadings, "blood-pressure");

            stateTables.weight.innerHTML = [...weightRows].reverse()
                .map((reading) => tableRow(reading, "weight", settings)).join("");
            stateTables.bloodPressure.innerHTML = [...bloodPressureRows].reverse()
                .map((reading) => tableRow(reading, "blood-pressure", settings)).join("");
        }

        const weightData = toWeightData(weightReadings);
        const bloodPressureData = toBloodPressureData(bloodPressureReadings);
        stateWeightChart.$activeRange = range;
        stateBloodPressureChart.$activeRange = range;
        stateWeightChart.data.datasets[0].data = weightData;
        stateBloodPressureChart.data.datasets[0].data = bloodPressureData.systolic;
        stateBloodPressureChart.data.datasets[1].data = bloodPressureData.diastolic;
        updateTimeScale(stateWeightChart, settings);
        updateTimeScale(stateBloodPressureChart, settings);

        if (weightData.length) {
            const rangeY = getWeightRange(weightData);
            stateWeightChart.options.scales.y.min = rangeY.min;
            stateWeightChart.options.scales.y.max = rangeY.max;
        }
        if (bloodPressureData.systolic.length) {
            const rangeY = getBloodPressureRange(bloodPressureData);
            stateBloodPressureChart.options.scales.y.min = rangeY.min;
            stateBloodPressureChart.options.scales.y.max = rangeY.max;
        }

        stateWeightChart.update();
        stateBloodPressureChart.update();
    };

    const stateViewActions = noRecentRoot.querySelectorAll(".view-action[data-view]");
    const stateRangeActions = noRecentRoot.querySelectorAll(".chart-range-action");
    const stateTableViews = noRecentRoot.querySelectorAll(".measurement-table-rows");
    const stateChartViews = noRecentRoot.querySelectorAll(".measurement-chart");

    stateViewActions.forEach((action) => {
        action.addEventListener("click", () => {
            const showGraphs = action.dataset.view === "graph";
            setPressedAction(stateViewActions, action);
            stateTableViews.forEach((view) => { view.hidden = showGraphs; });
            stateChartViews.forEach((view) => { view.hidden = !showGraphs; });
            if (showGraphs) {
                requestAnimationFrame(() => {
                    stateWeightChart.resize();
                    stateBloodPressureChart.resize();
                });
            }
        });
    });

    stateRangeActions.forEach((action) => {
        action.addEventListener("click", () => {
            setPressedAction(stateRangeActions, action);
            renderState(action.dataset.range);
        });
    });

    renderState("4d");
}

const denseWeightReadings = [];
const denseBloodPressureReadings = [];
for (
    let time = new Date("2026-03-09T08:00:00").getTime(), index = 0;
    time <= new Date("2026-05-08T20:00:00").getTime();
    time += 6 * 60 * 60 * 1000, index += 1
) {
    denseWeightReadings.push({
        time,
        weight: Math.round((151 - index * 0.055 + Math.sin(index / 3) * 0.8) * 10) / 10
    });
    denseBloodPressureReadings.push({
        time,
        systolic: Math.round(132 + Math.sin(index / 2) * 9),
        diastolic: Math.round(82 + Math.cos(index / 3) * 6)
    });
}

const populatedProfiles = {
    extensive: {
        weight: denseWeightReadings,
        bloodPressure: denseBloodPressureReadings
    }
};

const setupPopulatedPrototype = (root, sources) => {
    let selectedRange = "4d";

    const getProfileReadings = (range, measurement) => {
        const settings = rangeSettings[range];
        const min = new Date(settings.min).getTime();
        const max = new Date(settings.max).getTime();
        const readings = sources[measurement].filter(({ time }) => time >= min && time <= max);

        if (range === "1w") return averageReadings(readings, dayKey);
        if (range === "2m") return averageReadings(readings, weekKey);
        return readings;
    };

    const profileTooltip = {
        callbacks: {
            title: (items) => {
                const timestamp = items[0].parsed.x;
                if (selectedRange === "2m") return formatWeekRange(timestamp);
                return new Intl.DateTimeFormat("en-US", selectedRange === "4d"
                    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                    : { month: "short", day: "numeric" }
                ).format(new Date(timestamp));
            },
            label: ({ parsed }) => String(parsed.y)
        }
    };

    const makeOptions = (settings, min, max, stepSize) => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        normalized: true,
        interaction: { mode: "nearest", intersect: false, axis: "x" },
        layout: { padding: { top: 8, right: 24 } },
        plugins: { legend: { display: false }, tooltip: profileTooltip },
        scales: {
            x: makeTimeScale(settings),
            y: {
                min,
                max,
                grid: { color: colors["chart-grid"] },
                ticks: {
                    color: "rgb(60, 60, 60)",
                    font: { family: "Segoe UI", size: 11 },
                    stepSize
                }
            }
        }
    });

    const initialWeightReadings = getProfileReadings(selectedRange, "weight");
    const initialBloodPressureReadings = getProfileReadings(selectedRange, "bloodPressure");
    const initialWeightData = toWeightData(initialWeightReadings);
    const initialBloodPressureData = toBloodPressureData(initialBloodPressureReadings);
    const initialWeightRange = getWeightRange(initialWeightData);
    const initialBloodPressureRange = getBloodPressureRange(initialBloodPressureData);

    const profileWeightChart = new Chart(root.querySelector('[data-chart="weight"]'), {
        type: "line",
        data: {
            datasets: [{
                label: "Weight",
                data: initialWeightData,
                borderColor: colors["chart-weight"],
                backgroundColor: colors["chart-weight"],
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBorderWidth: 3,
                pointBorderColor: colors["chart-weight"],
                pointBackgroundColor: colors["app-background"],
                tension: 0.2
            }]
        },
        options: makeOptions(rangeSettings[selectedRange], initialWeightRange.min, initialWeightRange.max, 1),
        plugins: [daySeparators, valueLabels]
    });

    const profileBloodPressureChart = new Chart(root.querySelector('[data-chart="blood-pressure"]'), {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Systolic",
                    data: initialBloodPressureData.systolic,
                    pointStyle: "circle",
                    pointRadius: 6,
                    pointHoverRadius: 7,
                    backgroundColor: colors["chart-systolic"],
                    borderColor: colors["chart-systolic"]
                },
                {
                    label: "Diastolic",
                    data: initialBloodPressureData.diastolic,
                    pointStyle: "rect",
                    pointRadius: 6,
                    pointHoverRadius: 7,
                    backgroundColor: colors["chart-diastolic"],
                    borderColor: colors["chart-diastolic"]
                }
            ]
        },
        options: makeOptions(
            rangeSettings[selectedRange],
            initialBloodPressureRange.min,
            initialBloodPressureRange.max,
            10
        ),
        plugins: [daySeparators, readingConnectors, valueLabels]
    });

    profileWeightChart.$activeRange = selectedRange;
    profileBloodPressureChart.$activeRange = selectedRange;

    const tableViews = {
        weight: root.querySelector('[data-measurement-table="weight"]'),
        bloodPressure: root.querySelector('[data-measurement-table="blood-pressure"]')
    };
    const note = root.querySelector(".aggregation-note");

    const updateProfile = (range) => {
        selectedRange = range;
        const settings = rangeSettings[range];
        const weightReadings = getProfileReadings(range, "weight");
        const bloodPressureReadings = getProfileReadings(range, "bloodPressure");
        const weightData = toWeightData(weightReadings);
        const bloodPressureData = toBloodPressureData(bloodPressureReadings);
        const weightYRange = getWeightRange(weightData);
        const bloodPressureYRange = getBloodPressureRange(bloodPressureData);

        tableViews.weight.innerHTML = [...weightReadings].reverse()
            .map((reading) => tableRow(reading, "weight", settings)).join("");
        tableViews.bloodPressure.innerHTML = [...bloodPressureReadings].reverse()
            .map((reading) => tableRow(reading, "blood-pressure", settings)).join("");
        note.textContent = settings.note;
        note.hidden = !settings.note;

        profileWeightChart.$activeRange = range;
        profileBloodPressureChart.$activeRange = range;
        profileWeightChart.data.datasets[0].data = weightData;
        profileBloodPressureChart.data.datasets[0].data = bloodPressureData.systolic;
        profileBloodPressureChart.data.datasets[1].data = bloodPressureData.diastolic;
        updateTimeScale(profileWeightChart, settings);
        updateTimeScale(profileBloodPressureChart, settings);
        profileWeightChart.options.scales.y.min = weightYRange.min;
        profileWeightChart.options.scales.y.max = weightYRange.max;
        profileBloodPressureChart.options.scales.y.min = bloodPressureYRange.min;
        profileBloodPressureChart.options.scales.y.max = bloodPressureYRange.max;
        profileWeightChart.update();
        profileBloodPressureChart.update();
    };

    const viewActions = root.querySelectorAll(".view-action[data-view]");
    const rangeActions = root.querySelectorAll(".chart-range-action[data-range]");
    const profileTableViews = root.querySelectorAll(".measurement-table-rows");
    const profileChartViews = root.querySelectorAll(".measurement-chart");

    viewActions.forEach((action) => {
        action.addEventListener("click", () => {
            const showGraphs = action.dataset.view === "graph";
            setPressedAction(viewActions, action);
            profileTableViews.forEach((view) => { view.hidden = showGraphs; });
            profileChartViews.forEach((view) => { view.hidden = !showGraphs; });
            if (showGraphs) {
                requestAnimationFrame(() => {
                    profileWeightChart.resize();
                    profileBloodPressureChart.resize();
                });
            }
        });
    });

    rangeActions.forEach((action) => {
        action.addEventListener("click", () => {
            setPressedAction(rangeActions, action);
            updateProfile(action.dataset.range);
        });
    });

    updateProfile(selectedRange);
};

document.querySelectorAll('[data-prototype="extensive"]')
    .forEach((root) => setupPopulatedPrototype(root, populatedProfiles[root.dataset.prototype]));

const workingPrototype = document.querySelector("#prototype");
const themeActions = document.querySelectorAll(".prototype-style-option[data-theme]");

themeActions.forEach((action) => {
    action.addEventListener("click", () => {
        workingPrototype.classList.remove("theme-white", "theme-blue", "theme-creme");
        workingPrototype.classList.add(`theme-${action.dataset.theme}`);

        themeActions.forEach((candidate) => {
            const isActive = candidate === action;
            candidate.classList.toggle("is-active", isActive);
            candidate.setAttribute("aria-pressed", String(isActive));
        });

        const activeTheme = getComputedStyle(workingPrototype);
        Object.keys(colors).forEach((name) => {
            colors[name] = activeTheme.getPropertyValue(`--${name}`).trim();
        });

        workingPrototype.querySelectorAll("canvas").forEach((canvas) => {
            const chart = Chart.getChart(canvas);
            if (!chart) return;
            const weightDataset = chart.data.datasets.find(({ label }) => label === "Weight");
            if (weightDataset) weightDataset.pointBackgroundColor = colors["app-background"];
            chart.update("none");
        });
    });
});

const journalSheet = workingPrototype.querySelector("#journal-sheet");
const journalButton = workingPrototype.querySelector(".journal-launch-button");
const journalBackdrop = workingPrototype.querySelector(".journal-backdrop");
const journalEntryBackdrop = workingPrototype.querySelector(".journal-entry-backdrop");
const journalEntryPopover = workingPrototype.querySelector(".journal-entry-popover");
const journalEntryClose = workingPrototype.querySelector(".journal-entry-close");
const journalEntryDate = workingPrototype.querySelector("#journal-entry-date");
const journalEntryText = workingPrototype.querySelector(".journal-entry-text");
const journalEntryInput = workingPrototype.querySelector(".journal-entry-input");
const journalEntryAction = workingPrototype.querySelector(".journal-entry-action");
const journalDays = workingPrototype.querySelectorAll("button.journal-day");
const exampleJournalEntry = "Today I felt steady and comfortable. I took my measurements after breakfast and went for a short walk.";
const journalEntries = new Map(
    [...journalDays]
        .filter((day) => day.classList.contains("journal-day--entry"))
        .map((day) => [Number(day.querySelector("span").textContent), exampleJournalEntry])
);
let selectedJournalDay = null;

const closeJournalEntry = () => {
    journalEntryBackdrop.hidden = true;
    journalEntryPopover.hidden = true;
    journalEntryPopover.setAttribute("aria-hidden", "true");
    journalEntryInput.hidden = true;
    journalEntryText.hidden = false;
};

const setJournalOpen = (isOpen) => {
    if (!isOpen) closeJournalEntry();
    workingPrototype.classList.toggle("is-journal-open", isOpen);
    journalSheet.setAttribute("aria-hidden", String(!isOpen));
    journalButton.setAttribute("aria-expanded", String(isOpen));
    journalButton.textContent = isOpen ? "Close Journal" : "Open Journal";
};

journalButton.addEventListener("click", () => {
    setJournalOpen(!workingPrototype.classList.contains("is-journal-open"));
});

journalBackdrop.addEventListener("click", () => {
    setJournalOpen(false);
    journalButton.focus();
});

const positionJournalEntry = (day) => {
    journalEntryPopover.style.visibility = "hidden";
    journalEntryPopover.hidden = false;

    const frameRect = workingPrototype.getBoundingClientRect();
    const dayRect = day.getBoundingClientRect();
    const popoverWidth = journalEntryPopover.offsetWidth;
    const popoverHeight = journalEntryPopover.offsetHeight;
    const preferredTop = dayRect.top - frameRect.top - popoverHeight - 12;
    const top = Math.max(16, Math.min(preferredTop, frameRect.height - popoverHeight - 16));
    const popoverLeft = (frameRect.width - popoverWidth) / 2;
    const pointerLeft = Math.max(18, Math.min(
        dayRect.left - frameRect.left + dayRect.width / 2 - popoverLeft,
        popoverWidth - 18
    ));

    journalEntryPopover.style.top = `${top}px`;
    journalEntryPopover.style.setProperty("--pointer-left", `${pointerLeft}px`);
    journalEntryPopover.style.visibility = "visible";
};

const renderJournalEntry = () => {
    const dayNumber = Number(selectedJournalDay.querySelector("span").textContent);
    const entry = journalEntries.get(dayNumber);

    journalEntryDate.textContent = `May ${dayNumber}`;
    journalEntryText.textContent = entry || "No journal entry.";
    journalEntryText.hidden = false;
    journalEntryInput.hidden = true;
    journalEntryAction.textContent = entry ? "Edit" : "Add Entry";
};

journalDays.forEach((day) => {
    day.addEventListener("click", () => {
        selectedJournalDay = day;
        renderJournalEntry();
        journalEntryBackdrop.hidden = false;
        journalEntryPopover.setAttribute("aria-hidden", "false");
        positionJournalEntry(day);
        journalEntryClose.focus();
    });
});

journalEntryAction.addEventListener("click", () => {
    const isEditing = !journalEntryInput.hidden;
    const dayNumber = Number(selectedJournalDay.querySelector("span").textContent);

    if (!isEditing) {
        journalEntryInput.value = journalEntries.get(dayNumber) || "";
        journalEntryText.hidden = true;
        journalEntryInput.hidden = false;
        journalEntryAction.textContent = "Save";
        positionJournalEntry(selectedJournalDay);
        journalEntryInput.focus();
        return;
    }

    const entry = journalEntryInput.value.trim();
    if (entry) {
        journalEntries.set(dayNumber, entry);
        selectedJournalDay.classList.add("journal-day--entry");
        selectedJournalDay.setAttribute("aria-label", `May ${dayNumber}, journal entry`);
    } else {
        journalEntries.delete(dayNumber);
        selectedJournalDay.classList.remove("journal-day--entry");
        selectedJournalDay.setAttribute("aria-label", `May ${dayNumber}, add journal entry`);
    }
    renderJournalEntry();
    positionJournalEntry(selectedJournalDay);
});

journalEntryClose.addEventListener("click", () => {
    closeJournalEntry();
    selectedJournalDay?.focus();
});

journalEntryBackdrop.addEventListener("click", () => {
    closeJournalEntry();
    selectedJournalDay?.focus();
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!journalEntryPopover.hidden) {
        closeJournalEntry();
        selectedJournalDay?.focus();
    } else if (workingPrototype.classList.contains("is-journal-open")) {
        setJournalOpen(false);
        journalButton.focus();
    }
});
