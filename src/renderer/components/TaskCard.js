"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskCard = void 0;
const react_1 = __importDefault(require("react"));
const sortable_1 = require("@dnd-kit/sortable");
const utilities_1 = require("@dnd-kit/utilities");
const TaskCard = ({ task, onEdit, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, } = (0, sortable_1.useSortable)({ id: task.id });
    const style = {
        transform: utilities_1.CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 1,
    };
    const formatDate = (dateString) => {
        if (!dateString)
            return null;
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
        });
    };
    return (react_1.default.createElement("div", { ref: setNodeRef, style: style, ...attributes, ...listeners, className: `task-card ${task.status}` },
        react_1.default.createElement("div", { className: "task-title" }, task.title),
        react_1.default.createElement("div", { className: "task-meta" },
            task.description && (react_1.default.createElement("span", { className: "task-meta-item" },
                react_1.default.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
                    react_1.default.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
                    react_1.default.createElement("polyline", { points: "14 2 14 8 20 8" }),
                    react_1.default.createElement("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
                    react_1.default.createElement("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
                    react_1.default.createElement("polyline", { points: "10 9 9 9 8 9" })),
                "\u6709\u63CF\u8FF0")),
            task.expected_date && (react_1.default.createElement("span", { className: "task-meta-item" },
                react_1.default.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
                    react_1.default.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
                    react_1.default.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
                    react_1.default.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
                    react_1.default.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })),
                formatDate(task.expected_date)))),
        react_1.default.createElement("div", { className: "task-actions" },
            react_1.default.createElement("button", { className: "task-action-btn edit", onClick: () => onEdit(task) },
                react_1.default.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
                    react_1.default.createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                    react_1.default.createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })),
                "\u7F16\u8F91"),
            react_1.default.createElement("button", { className: "task-action-btn delete", onClick: () => onDelete(task.id) },
                react_1.default.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
                    react_1.default.createElement("polyline", { points: "3 6 5 6 21 6" }),
                    react_1.default.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })),
                "\u5220\u9664"))));
};
exports.TaskCard = TaskCard;
