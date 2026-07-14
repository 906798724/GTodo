"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskColumn = void 0;
const react_1 = __importDefault(require("react"));
const core_1 = require("@dnd-kit/core");
const sortable_1 = require("@dnd-kit/sortable");
const TaskCard_1 = require("./TaskCard");
const TaskColumn = ({ column, tasks, onEdit, onDelete }) => {
    const { setNodeRef, isOver } = (0, core_1.useDroppable)({
        id: column.id,
    });
    return (react_1.default.createElement("div", { className: "column" },
        react_1.default.createElement("div", { className: "column-header" },
            react_1.default.createElement("div", { className: "column-title" },
                react_1.default.createElement("span", null, column.icon),
                react_1.default.createElement("h2", null, column.title)),
            react_1.default.createElement("span", { className: "column-count" }, tasks.length)),
        react_1.default.createElement("div", { ref: setNodeRef, className: "column-content", style: {
                backgroundColor: isOver ? '#f5f5f5' : 'transparent',
            } }, tasks.length === 0 ? (react_1.default.createElement("div", { className: "empty-state" },
            react_1.default.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5" },
                react_1.default.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                react_1.default.createElement("polyline", { points: "12 6 12 12 16 14" })),
            react_1.default.createElement("p", null, "\u6682\u65E0\u4EFB\u52A1"))) : (react_1.default.createElement(sortable_1.SortableContext, { items: tasks.map((t) => t.id), strategy: sortable_1.verticalListSortingStrategy }, tasks.map((task) => (react_1.default.createElement(TaskCard_1.TaskCard, { key: task.id, task: task, onEdit: onEdit, onDelete: onDelete }))))))));
};
exports.TaskColumn = TaskColumn;
