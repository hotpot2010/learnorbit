export interface CourseStep {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  estimatedTime: string;
  type: 'theory' | 'practice';
  difficulty: 'easy' | 'medium' | 'hard';
  resources: {
    video?: {
      title: string;
      coverImage: string;
      url: string;
      duration: string;
    };
    materials?: string[];
  };
  exercise: {
    type: 'quiz' | 'coding';
    content: QuizExercise | CodingExercise;
  };
}

export interface QuizExercise {
  questions: Array<{
    id: string;
    question: string;
    type: 'choice';
    options: string[];
    correctAnswer: string;
    explanation?: string;
  }>;
}

export interface CodingExercise {
  title: string;
  description: string;
  template: string;
  solution: string;
  testCases: Array<{
    input: string;
    expectedOutput: string;
  }>;
}

export const mockCourseData: CourseStep[] = [
  {
    id: 'step-1',
    title: 'Understanding Reinforcement Learning Fundamentals',
    description:
      'Learn core concepts: agents, environments, states, actions, and rewards',
    status: 'completed',
    estimatedTime: '2 hours',
    type: 'theory',
    difficulty: 'easy',
    resources: {
      video: {
        title: 'Introduction to Reinforcement Learning',
        coverImage: '/images/course/rl-intro.jpg',
        url: '//player.bilibili.com/player.html?isOutside=true&aid=114829389995999&bvid=BV11PG5zFEMP&cid=30962879724&p=1',
        duration: '15:30',
      },
      materials: [
        'RL Fundamentals PDF',
        'Key Terms Glossary',
        'Interactive Environment Demo',
      ],
    },
    exercise: {
      type: 'quiz',
      content: {
        questions: [
          {
            id: 'q1',
            question:
              'What is the primary goal of an agent in reinforcement learning?',
            type: 'choice',
            options: [
              'To explore the environment as much as possible',
              'To maximize cumulative reward over time',
              'To accurately predict all possible states',
            ],
            correctAnswer: 'To maximize cumulative reward over time',
            explanation:
              'The agent aims to learn a policy that maximizes the expected cumulative reward.',
          },
          {
            id: 'q2',
            question: 'Which of the following is NOT a core component of RL?',
            type: 'choice',
            options: ['Agent', 'Environment', 'Supervised Labels'],
            correctAnswer: 'Supervised Labels',
            explanation:
              'RL learns from rewards, not supervised labels like in supervised learning.',
          },
        ],
      },
    },
  },
  {
    id: 'step-2',
    title: 'Q-Learning Algorithm Principles',
    description:
      'Deep dive into Q-Learning mathematical foundations and update rules',
    status: 'completed',
    estimatedTime: '3 hours',
    type: 'theory',
    difficulty: 'medium',
    resources: {
      video: {
        title: 'Q-Learning: Theory and Mathematics',
        coverImage: '/images/course/q-learning-math.jpg',
        url: '//player.bilibili.com/player.html?isOutside=true&aid=114829389995999&bvid=BV11PG5zFEMP&cid=30962879724&p=2',
        duration: '22:45',
      },
      materials: [
        'Q-Learning Equations Reference',
        'Bellman Equation Explained',
        'Mathematical Proofs',
      ],
    },
    exercise: {
      type: 'quiz',
      content: {
        questions: [
          {
            id: 'q3',
            question: 'The Q-value represents:',
            type: 'choice',
            options: [
              'The immediate reward for an action',
              'The expected future reward for a state-action pair',
              'The probability of reaching a goal state',
            ],
            correctAnswer: 'The expected future reward for a state-action pair',
            explanation:
              'Q(s,a) estimates the expected cumulative reward starting from state s, taking action a.',
          },
          {
            id: 'q4',
            question: 'What does the learning rate (α) control in Q-learning?',
            type: 'choice',
            options: [
              'How much new information overrides old information',
              'The exploration vs exploitation trade-off',
              'The discount factor for future rewards',
            ],
            correctAnswer: 'How much new information overrides old information',
            explanation:
              'Alpha determines how quickly the Q-values are updated with new experiences.',
          },
        ],
      },
    },
  },
  {
    id: 'step-3',
    title: 'Implementing Basic Q-Learning Algorithm',
    description: 'Code the core Q-Learning algorithm from scratch using Python',
    status: 'current',
    estimatedTime: '4 hours',
    type: 'practice',
    difficulty: 'hard',
    resources: {
      video: {
        title: 'Coding Q-Learning Step by Step',
        coverImage: '/images/course/coding-qlearning.jpg',
        url: '//player.bilibili.com/player.html?isOutside=true&aid=114829389995999&bvid=BV11PG5zFEMP&cid=30962879724&p=3',
        duration: '28:15',
      },
      materials: [
        'Python Starter Template',
        'NumPy Reference Guide',
        'Code Examples Repository',
      ],
    },
    exercise: {
      type: 'coding',
      content: {
        title: 'Implement Q-Learning Update Rule',
        description:
          'Complete the Q-value update function using the Bellman equation',
        template: `import numpy as np

def update_q_table(Q, state, action, reward, next_state, alpha, gamma):
    """
    Update Q-table using the Q-learning update rule
    
    Args:
        Q: Q-table (numpy array)
        state: current state
        action: action taken
        reward: reward received
        next_state: next state reached
        alpha: learning rate
        gamma: discount factor
    
    Returns:
        Updated Q-table
    """
    # TODO: Implement the Q-learning update rule
    # Q(s,a) = Q(s,a) + α[r + γ * max(Q(s',a')) - Q(s,a)]
    
    current_q = _______________
    max_next_q = _______________
    new_q = _______________
    
    Q[state][action] = new_q
    return Q`,
        solution: `import numpy as np

def update_q_table(Q, state, action, reward, next_state, alpha, gamma):
    current_q = Q[state][action]
    max_next_q = np.max(Q[next_state])
    new_q = current_q + alpha * (reward + gamma * max_next_q - current_q)
    
    Q[state][action] = new_q
    return Q`,
        testCases: [
          {
            input:
              'Q=[[0,0],[0,0]], state=0, action=0, reward=1, next_state=1, alpha=0.1, gamma=0.9',
            expectedOutput: 'Q[0][0] = 0.1',
          },
          {
            input:
              'Q=[[0.5,0.3],[0.2,0.8]], state=0, action=1, reward=2, next_state=1, alpha=0.2, gamma=0.8',
            expectedOutput: 'Q[0][1] = 0.62',
          },
        ],
      },
    },
  },
  {
    id: 'step-4',
    title: 'Building a Grid World Environment',
    description:
      'Create a maze environment for the agent to navigate and learn',
    status: 'pending',
    estimatedTime: '3 hours',
    type: 'practice',
    difficulty: 'medium',
    resources: {
      video: {
        title: 'Creating Interactive Environments',
        coverImage: '/images/course/grid-world.jpg',
        url: '//player.bilibili.com/player.html?isOutside=true&aid=114829389995999&bvid=BV11PG5zFEMP&cid=30962879724&p=4',
        duration: '19:20',
      },
      materials: [
        'Environment Design Patterns',
        'Pygame Tutorial',
        'Grid World Templates',
      ],
    },
    exercise: {
      type: 'coding',
      content: {
        title: 'Design Grid World Class',
        description:
          'Implement a grid world environment with obstacles, goals, and rewards',
        template: `class GridWorld:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.grid = np.zeros((height, width))
        self.agent_pos = [0, 0]
        self.goal_pos = [height-1, width-1]
        
    def step(self, action):
        """
        Execute action and return new_state, reward, done
        Actions: 0=up, 1=right, 2=down, 3=left
        """
        # TODO: Implement environment step function
        pass
        
    def reset(self):
        # TODO: Reset agent to starting position
        pass`,
        solution: `class GridWorld:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.grid = np.zeros((height, width))
        self.agent_pos = [0, 0]
        self.goal_pos = [height-1, width-1]
        
    def step(self, action):
        old_pos = self.agent_pos.copy()
        
        # Define actions: up, right, down, left
        actions = [(-1, 0), (0, 1), (1, 0), (0, -1)]
        dy, dx = actions[action]
        
        new_y = max(0, min(self.height-1, self.agent_pos[0] + dy))
        new_x = max(0, min(self.width-1, self.agent_pos[1] + dx))
        
        self.agent_pos = [new_y, new_x]
        
        reward = 10 if self.agent_pos == self.goal_pos else -0.1
        done = self.agent_pos == self.goal_pos
        
        return self.agent_pos, reward, done
        
    def reset(self):
        self.agent_pos = [0, 0]
        return self.agent_pos`,
        testCases: [
          {
            input: 'env = GridWorld(5, 5); env.step(1)',
            expectedOutput: 'agent_pos = [0, 1], reward = -0.1',
          },
          {
            input: 'env.agent_pos = [4, 4]; env.step(1)',
            expectedOutput: 'reward = 10, done = True',
          },
        ],
      },
    },
  },
  {
    id: 'step-5',
    title: 'Training the Agent for Optimal Pathfinding',
    description:
      'Train the Q-learning agent to find optimal paths in the maze environment',
    status: 'pending',
    estimatedTime: '4 hours',
    type: 'practice',
    difficulty: 'hard',
    resources: {
      video: {
        title: 'Training and Optimization Strategies',
        coverImage: '/images/course/agent-training.jpg',
        url: '//player.bilibili.com/player.html?isOutside=true&aid=114829389995999&bvid=BV11PG5zFEMP&cid=30962879724&p=5',
        duration: '25:40',
      },
      materials: [
        'Training Loop Best Practices',
        'Hyperparameter Tuning Guide',
        'Performance Metrics',
      ],
    },
    exercise: {
      type: 'coding',
      content: {
        title: 'Implement Training Loop',
        description:
          'Create a complete training loop with epsilon-greedy exploration',
        template: `def train_agent(env, episodes=1000, alpha=0.1, gamma=0.9, epsilon=0.1):
    """
    Train Q-learning agent using epsilon-greedy exploration
    """
    Q = np.zeros((env.height * env.width, 4))  # state-action table
    
    for episode in range(episodes):
        state = env.reset()
        done = False
        
        while not done:
            # TODO: Implement epsilon-greedy action selection
            if np.random.random() < epsilon:
                action = _______________  # explore
            else:
                action = _______________  # exploit
                
            next_state, reward, done = env.step(action)
            
            # TODO: Update Q-table
            _______________
            
            state = next_state
            
    return Q`,
        solution: `def train_agent(env, episodes=1000, alpha=0.1, gamma=0.9, epsilon=0.1):
    Q = np.zeros((env.height * env.width, 4))
    
    def state_to_index(pos):
        return pos[0] * env.width + pos[1]
    
    for episode in range(episodes):
        state = env.reset()
        done = False
        
        while not done:
            state_idx = state_to_index(state)
            
            if np.random.random() < epsilon:
                action = np.random.choice(4)  # explore
            else:
                action = np.argmax(Q[state_idx])  # exploit
                
            next_state, reward, done = env.step(action)
            next_state_idx = state_to_index(next_state)
            
            # Q-learning update
            current_q = Q[state_idx][action]
            max_next_q = np.max(Q[next_state_idx])
            Q[state_idx][action] = current_q + alpha * (reward + gamma * max_next_q - current_q)
            
            state = next_state
            
    return Q`,
        testCases: [
          {
            input: 'train_agent(GridWorld(3,3), episodes=100)',
            expectedOutput: 'Q-table with improved values for optimal path',
          },
        ],
      },
    },
  },
  {
    id: 'step-6',
    title: 'Visualizing Learning Progress and Results',
    description:
      'Create visualizations to demonstrate the learning process and final policy',
    status: 'pending',
    estimatedTime: '2 hours',
    type: 'practice',
    difficulty: 'easy',
    resources: {
      video: {
        title: 'Data Visualization for RL',
        coverImage: '/images/course/visualization.jpg',
        url: '//player.bilibili.com/player.html?isOutside=true&aid=114829389995999&bvid=BV11PG5zFEMP&cid=30962879724&p=6',
        duration: '16:55',
      },
      materials: [
        'Matplotlib RL Examples',
        'Interactive Plot Templates',
        'Animation Techniques',
      ],
    },
    exercise: {
      type: 'quiz',
      content: {
        questions: [
          {
            id: 'q5',
            question: 'What does a heatmap of Q-values help visualize?',
            type: 'choice',
            options: [
              "The agent's preferred actions in each state",
              'The difficulty of different environments',
              'The speed of convergence',
            ],
            correctAnswer: "The agent's preferred actions in each state",
            explanation:
              'Q-value heatmaps show which actions the agent considers most valuable in each state.',
          },
          {
            id: 'q6',
            question:
              'Why is it important to plot reward over episodes during training?',
            type: 'choice',
            options: [
              'To show off to other researchers',
              'To monitor learning progress and detect convergence',
              'To calculate the final policy accuracy',
            ],
            correctAnswer:
              'To monitor learning progress and detect convergence',
            explanation:
              'Reward curves help identify when the agent has learned an optimal policy and training can stop.',
          },
        ],
      },
    },
  },
];

export default mockCourseData;
