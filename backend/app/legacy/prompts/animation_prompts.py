"""
动画相关的提示词模板
根据不同的动画类型提供专门的动画指令生成提示

重要说明：
- 系统仅支持两种动画类型：maze_demo（迷宫演示）和 table_demo（表格演示）
- 严格禁止使用其他任何动画类型，如：fade_in、slide_in、zoom_in、demo_type等
- 如果任务不适合这两种动画类型，请不要添加动画指令
"""

def get_maze_animation_prompt():
    """迷宫动画的提示词"""
    return """
### 迷宫动画演示支持
如果任务涉及需要迷宫动画演示的内容（如算法可视化、路径规划、强化学习、游戏规则等），请在PPT内容中使用以下格式：

**重要：动画指令必须严格按照以下格式，使用具体的坐标和路径数据，不能使用"随机"、"展示"等描述性文字**
**动画类型必须是：maze_demo，不能使用其他任何类型名称**

#### maze_demo 参数规范：
- **grid_size**：必须是具体尺寸如"5x5"、"4x4"等
- **start_pos**：起点坐标如"(0,0)"、"(0,4)"等 
- **goal_pos**：终点坐标如"(4,4)"、"(3,0)"等
- **walls**：墙壁坐标数组如"[(1,1),(2,2),(3,1)]"，或使用"[]"表示无墙壁
- **demo_paths**：演示路径，格式为"路径名[坐标→坐标→坐标]"，多条路径用"|"分隔
- **rules**：游戏规则描述

#### 标准示例（必须严格遵循）：
```
[ANIMATION:maze_demo]
grid_size：5x5
start_pos：(0,4)
goal_pos：(4,0)
walls：[(1,1),(2,2),(3,1)]
demo_paths：最短路径[0,4→1,4→2,4→3,4→4,4→4,3→4,2→4,1→4,0] | 探索路径[0,4→0,3→0,2→0,1→0,0→1,0→2,0→3,0→4,0→4,1→4,2→4,3→4,4]
rules：移动-1分，撞墙-10分，到达+100分
[/ANIMATION]
```

#### 简化示例（适用于基础演示）：
```
[ANIMATION:maze_demo]
grid_size：4x4
start_pos：(0,0)
goal_pos：(3,3)
walls：[(1,1),(2,1)]
demo_paths：直线路径[0,0→1,0→2,0→3,0→3,1→3,2→3,3]
rules：每步-1分，到达+100分
[/ANIMATION]
```

**严格禁止的格式**：
- ❌ walls：随机分布
- ❌ demo_paths：展示一条路径
- ❌ walls：随机展示
- ❌ demo_paths：最优路径演示

**必须使用的格式**：
- ✅ walls：[(1,1),(2,2)]
- ✅ demo_paths：最短路径[0,0→1,0→2,0→3,0]
- ✅ walls：[]（表示无墙壁）
"""

def get_table_animation_prompt():
    """表格动画的提示词"""
    return """
### 表格动画演示支持
如果任务涉及需要表格动画演示的内容（如数据结构操作、状态表更新、Q值表变化、算法比较等），请在PPT内容中使用以下格式：

**重要：动画指令必须严格按照以下格式，使用具体的表格数据和动画步骤**
**动画类型必须是：table_demo，不能使用其他任何类型名称**

#### table_demo 参数规范：
- **title**：表格标题，如"Q值表"、"状态转换表"等
- **headers**：表头数组，如["状态", "向上", "向下", "向左", "向右"]
- **table_data**：初始表格数据，二维数组格式
- **animation_steps**：动画步骤数组，包含各种操作类型
- **animation_delay**：动画步骤间延迟时间（毫秒），可选

#### 动画步骤类型：
- **highlight_cell**：高亮单元格 {type: "highlight_cell", row: 0, col: 1, color: "#FFE082", description: "当前选择的动作"}
- **highlight_row**：高亮整行 {type: "highlight_row", row: 0, color: "#E3F2FD", description: "当前状态"}
- **highlight_column**：高亮整列 {type: "highlight_column", col: 1, color: "#F3E5F5", description: "向上动作"}
- **update_cell**：更新单元格值 {type: "update_cell", row: 0, col: 1, value: "0.8", highlight_color: "#C8E6C9", description: "Q值更新"}
- **add_row**：添加新行 {type: "add_row", data: ["新状态", "0", "0", "0", "0"], highlight_color: "#FFCDD2", description: "发现新状态"}
- **clear_highlights**：清除所有高亮 {type: "clear_highlights", description: "重置高亮"}

#### 标准示例（Q值表演示）：
```
[ANIMATION:table_demo]
title：Q值表学习过程
headers：["状态", "向上", "向下", "向左", "向右"]
table_data：[["(0,0)", "0", "0", "0", "0"], ["(0,1)", "0", "0", "0", "0"], ["(1,0)", "0", "0", "0", "0"]]
animation_steps：[{"type": "highlight_row", "row": 0, "color": "#E3F2FD", "description": "智能体在状态(0,0)"}, {"type": "highlight_cell", "row": 0, "col": 2, "color": "#FFE082", "description": "选择向下动作"}, {"type": "update_cell", "row": 0, "col": 2, "value": "0.1", "highlight_color": "#C8E6C9", "description": "Q值初次更新"}, {"type": "clear_highlights", "description": "准备下一步"}]
animation_delay：1000
[/ANIMATION]
```

#### 简化示例（数据比较表）：
```
[ANIMATION:table_demo]
title：算法性能比较
headers：["算法", "时间复杂度", "空间复杂度", "稳定性"]
table_data：[["冒泡排序", "O(n²)", "O(1)", "稳定"], ["快速排序", "O(n log n)", "O(log n)", "不稳定"]]
animation_steps：[{"type": "highlight_column", "col": 1, "color": "#F3E5F5", "description": "比较时间复杂度"}, {"type": "highlight_column", "col": 2, "color": "#E8F5E8", "description": "比较空间复杂度"}]
[/ANIMATION]
```

**注意事项**：
- table_data和animation_steps必须是有效的JSON数组格式
- 行列索引从0开始计数
- 动画描述要简洁明了，说明当前操作的含义
- 颜色值使用十六进制格式，建议使用浅色系便于阅读
"""

def get_animation_prompt_by_type(animation_type):
    """根据动画类型返回相应的提示词"""
    if animation_type == "迷宫":
        return f"""
**关键提醒：动画类型约束**
- 必须使用 maze_demo 作为动画类型标签
- 绝对不能使用 fade_in、slide_in、zoom_in、demo_type 等其他名称
- 严格按照以下格式要求

{get_maze_animation_prompt()}"""
    elif animation_type == "表格":
        return f"""
**关键提醒：动画类型约束**
- 必须使用 table_demo 作为动画类型标签
- 绝对不能使用 fade_in、slide_in、zoom_in、demo_type 等其他名称
- 严格按照以下格式要求

{get_table_animation_prompt()}"""
    elif animation_type == "无":
        return ""
    else:
        return "" 