"use client";
import React, { useState } from 'react';
import { Play, Plus, Trash2, RefreshCw, BarChart } from 'lucide-react';

// ----------------------------------------------------------------------
// [Logic] 스케줄링 알고리즘 구현부 (Python 코드 포팅)
// ----------------------------------------------------------------------

const solveScheduler = (algo, inputProcesses, timeQuantum) => {
  // 1. 초기 데이터 준비 (Deep Copy & 초기화)
  // UI에서 사용하는 이름(arrivalTime, burstTime)을 내부 로직용(arrival, burst)으로 매핑
  let processes = inputProcesses.map(p => ({
    id: p.id,
    name: p.name,
    arrival: p.arrivalTime,
    burst: p.burstTime,
    remaining: p.burstTime, // 남은 시간
    completion: 0,          // 완료 시간
    waiting: 0,             // 대기 시간
    turnaround: 0,          // 반환 시간
    priority: 0.0,          // HRN용
    startTimes: []          // 간트 차트 기록용 (여러 번 실행될 수 있으므로 배열)
  }));

  let timeline = [];     // [{ processId, start, end }]
  let currentTime = 0;
  let completedCount = 0;
  const n = processes.length;

  // -------------------------------------------------------
  // 1. FCFS (First-Come, First-Served)
  // -------------------------------------------------------
  if (algo === 'FCFS') {
    // 도착 시간 순 정렬
    processes.sort((a, b) => a.arrival - b.arrival);

    processes.forEach(p => {
      if (currentTime < p.arrival) {
        // IDLE
        currentTime = p.arrival;
      }
      const start = currentTime;
      const end = start + p.burst;
      
      timeline.push({ processId: p.id, start, end });
      p.completion = end;
      currentTime = end;
    });
  }

  // -------------------------------------------------------
  // 2. SJF (Shortest Job First - Non Preemptive)
  // -------------------------------------------------------
  else if (algo === 'SJF') {
    let procList = [...processes]; // 작업용 리스트
    
    while (completedCount < n) {
      // 도착했고, 아직 완료되지 않은(remaining > 0) 프로세스 필터링
      // 주의: SJF는 비선점형이므로 remaining이 burst와 같은 것만 대상으로 해도 되지만,
      // 로직 일관성을 위해 remaining > 0으로 체크
      let available = procList.filter(p => p.arrival <= currentTime && p.remaining > 0);

      if (available.length === 0) {
        // IDLE: 다음 도착 시간으로 점프
        const remainingProcs = procList.filter(p => p.remaining > 0);
        if (remainingProcs.length === 0) break;
        
        const nextArrival = Math.min(...remainingProcs.map(p => p.arrival));
        currentTime = nextArrival;
        continue;
      }

      // Burst Time 짧은 순 정렬
      available.sort((a, b) => a.burst - b.burst);
      const job = available[0];

      // 실행 (비선점형이므로 끝까지)
      const start = currentTime;
      const end = start + job.burst;
      
      timeline.push({ processId: job.id, start, end });
      
      job.remaining = 0;
      job.completion = end;
      completedCount++;
      currentTime = end;
    }
  }

  // -------------------------------------------------------
  // 3. HRN (Highest Response Ratio Next - Non Preemptive)
  // -------------------------------------------------------
  else if (algo === 'HRN') {
    let procList = [...processes];

    while (completedCount < n) {
      let available = procList.filter(p => p.arrival <= currentTime && p.remaining > 0);

      if (available.length === 0) {
        const remainingProcs = procList.filter(p => p.remaining > 0);
        if (remainingProcs.length === 0) break;
        const nextArrival = Math.min(...remainingProcs.map(p => p.arrival));
        currentTime = nextArrival;
        continue;
      }

      // 우선순위 계산: (대기 + 작업) / 작업
      available.forEach(p => {
        const waitTime = currentTime - p.arrival;
        p.priority = (waitTime + p.burst) / p.burst;
      });

      // 우선순위 높은 순(내림차순) 정렬
      available.sort((a, b) => b.priority - a.priority);
      const job = available[0];

      // 실행
      const start = currentTime;
      const end = start + job.burst;
      
      timeline.push({ processId: job.id, start, end });
      
      job.remaining = 0;
      job.completion = end;
      completedCount++;
      currentTime = end;
    }
  }

  // -------------------------------------------------------
  // 4. RR (Round Robin - Preemptive)
  // -------------------------------------------------------
  else if (algo === 'RR') {
    // 도착 시간 순 정렬하여 초기 큐 진입 준비
    let procList = [...processes]; // 원본 참조 유지 (상태 업데이트용)
    // 큐에는 객체 참조를 넣음
    let readyQueue = [];
    let inQueueOrDone = new Set(); // 중복 방지용

    // 루프 시작 전 로직: 0초에 도착한 애들 넣기? 
    // Python 로직 그대로 구현: while 루프 안에서 처리
    
    while (completedCount < n) {
      // 1. 현재 시간까지 도착했고, 큐/완료 목록에 없는 프로세스 큐에 추가
      let newlyArrived = procList.filter(p => 
        p.arrival <= currentTime && !inQueueOrDone.has(p.id)
      );
      newlyArrived.sort((a, b) => a.arrival - b.arrival);

      newlyArrived.forEach(p => {
        readyQueue.push(p);
        inQueueOrDone.add(p.id);
      });

      // 2. 큐가 비었으면 IDLE
      if (readyQueue.length === 0) {
        let waitingProcs = procList.filter(p => !inQueueOrDone.has(p.id));
        if (waitingProcs.length === 0) break; // 끝

        const nextArrival = Math.min(...waitingProcs.map(p => p.arrival));
        // IDLE 구간
        if (nextArrival > currentTime) {
            currentTime = nextArrival;
        }
        continue;
      }

      // 3. 큐에서 pop
      const job = readyQueue.shift();
      const start = currentTime;
      
      // 4. 실행 시간 계산
      let runTime = 0;
      if (job.remaining <= timeQuantum) {
        runTime = job.remaining;
        job.remaining = 0;
        completedCount++;
        currentTime += runTime;
        job.completion = currentTime;
      } else {
        runTime = timeQuantum;
        job.remaining -= timeQuantum;
        currentTime += runTime;
      }

      timeline.push({ processId: job.id, start, end: currentTime });

      // 5. 실행 '도중' 도착한 프로세스 추가 (중요: 현재 작업 다시 넣기 전에!)
      let arrivedDuringRun = procList.filter(p => 
        p.arrival > start && p.arrival <= currentTime && !inQueueOrDone.has(p.id)
      );
      arrivedDuringRun.sort((a, b) => a.arrival - b.arrival);
      
      arrivedDuringRun.forEach(p => {
        readyQueue.push(p);
        inQueueOrDone.add(p.id);
      });

      // 6. 작업 안 끝났으면 다시 큐 뒤로
      if (job.remaining > 0) {
        readyQueue.push(job);
      }
    }
  }

  // -------------------------------------------------------
  // 5. SRT (Shortest Remaining Time - Preemptive)
  // -------------------------------------------------------
  else if (algo === 'SRT') {
    let procList = [...processes];
    let verboseLog = []; // [processId, processId, 'IDLE', ...] 1초 단위 로그

    while (completedCount < n) {
      let ready = procList.filter(p => p.arrival <= currentTime && p.remaining > 0);

      if (ready.length === 0) {
        // IDLE 처리
        let waitingProcs = procList.filter(p => p.remaining > 0);
        if (waitingProcs.length === 0) break;

        const nextArrival = Math.min(...waitingProcs.map(p => p.arrival));
        // IDLE 채우기
        for (let t = currentTime; t < nextArrival; t++) {
          verboseLog.push('IDLE');
        }
        currentTime = nextArrival;
        continue;
      }

      // 남은 시간 짧은 순 정렬
      ready.sort((a, b) => a.remaining - b.remaining);
      const job = ready[0];

      // 1단위 실행
      verboseLog.push(job.id);
      job.remaining -= 1;
      currentTime += 1;

      if (job.remaining === 0) {
        job.completion = currentTime;
        completedCount++;
      }
    }

    // Verbose Log -> Compact Timeline 변환
    if (verboseLog.length > 0) {
      let currentId = verboseLog[0];
      let start = 0;
      
      for (let t = 1; t < verboseLog.length; t++) {
        if (verboseLog[t] !== currentId) {
          if (currentId !== 'IDLE') {
            timeline.push({ processId: currentId, start, end: t });
          }
          currentId = verboseLog[t];
          start = t;
        }
      }
      // 마지막 조각
      if (currentId !== 'IDLE') {
        timeline.push({ processId: currentId, start, end: verboseLog.length });
      }
    }
  }

  // -------------------------------------------------------
  // 6. 결과 통계 계산 (Waiting, Turnaround)
  // -------------------------------------------------------
  let finalStats = {};
  processes.forEach(p => {
    p.turnaround = p.completion - p.arrival;
    p.waiting = p.turnaround - p.burst;
    
    finalStats[p.id] = {
      completionTime: p.completion,
      waitingTime: p.waiting,
      turnaroundTime: p.turnaround
    };
  });

  // Timeline 간소화 (RR 등에서 연속된 같은 프로세스가 쪼개져 있을 경우 합치기)
  // 시각적으로 깔끔하게 보기 위해 선택 사항이지만, 
  // 여기서는 그대로 둡니다(Context Switch 확인용). 
  // 필요하다면 여기서 timeline을 순회하며 병합할 수 있습니다.

  return { timeline, finalStats };
};


// ----------------------------------------------------------------------
// [UI] React Component
// ----------------------------------------------------------------------

export default function CPUSimulator() {
  // --- State Management ---
  const [algorithm, setAlgorithm] = useState('FCFS');
  const [timeQuantum, setTimeQuantum] = useState(2);
  const [processes, setProcesses] = useState([
    { id: 1, name: 'Process 1', arrivalTime: 0, burstTime: 5 },
    { id: 2, name: 'Process 2', arrivalTime: 1, burstTime: 3 },
    { id: 3, name: 'Process 3', arrivalTime: 2, burstTime: 8 },
  ]);
  
  const [newProcess, setNewProcess] = useState({ arrivalTime: 0, burstTime: 1 });
  const [simulationResult, setSimulationResult] = useState(null);

  // --- Event Handlers ---
  const addProcess = () => {
    const nextId = processes.length > 0 ? Math.max(...processes.map(p => p.id)) + 1 : 1;
    setProcesses([
      ...processes,
      {
        id: nextId,
        name: `Process ${nextId}`,
        arrivalTime: parseInt(newProcess.arrivalTime) || 0,
        burstTime: parseInt(newProcess.burstTime) || 1
      }
    ]);
    setNewProcess({ arrivalTime: 0, burstTime: 1 }); // 입력 필드 초기화
  };

  const removeProcess = (id) => {
    setProcesses(processes.filter(p => p.id !== id));
  };

  const handleCalculate = () => {
    if (processes.length === 0) {
        alert("Please add a process.");
        return;
    }
    // Call algorithm function
    const result = solveScheduler(algorithm, processes, parseInt(timeQuantum));
    setSimulationResult(result);
  };

  const reset = () => {
    setProcesses([]);
    setSimulationResult(null);
  };

  // Chart Color Utility
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'
  ];
  const getColor = (id) => colors[(id - 1) % colors.length];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* 1. Header Area */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-blue-700 tracking-tight">CPU Burst Scheduling Simulator</h1>
          <p className="text-gray-500">CHU-OS-2025-2-PJ</p>
        </header>

        {/* 2. Input & Control Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Settings & Input Form */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Algorithm Selection */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <RefreshCw size={20} className="text-blue-500"/> Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Algorithm</label>
                  <select 
                    value={algorithm} 
                    onChange={(e) => { setAlgorithm(e.target.value); setSimulationResult(null); }}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  >
                    <option value="FCFS">FCFS (First-Come, First-Served)</option>
                    <option value="SJF">SJF (Shortest Job First - Non Preemptive)</option>
                    <option value="HRN">HRN (Highest Response Ratio Next)</option>
                    <option value="RR">RR (Round Robin)</option>
                    <option value="SRT">SRT (Shortest Remaining Time)</option>
                  </select>
                </div>
                
                {algorithm === 'RR' && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time Quantum</label>
                    <input 
                      type="number" 
                      min="1"
                      value={timeQuantum} 
                      onChange={(e) => setTimeQuantum(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Add Process Box */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus size={20} className="text-green-500"/> Add Process
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label className="text-xs text-gray-500">Arrival Time (AT)</label>
                    <input 
                        type="number" min="0"
                        value={newProcess.arrivalTime}
                        onChange={(e) => setNewProcess({...newProcess, arrivalTime: e.target.value})}
                        className="w-full p-2 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500">Burst Time (BT)</label>
                    <input 
                        type="number" min="1"
                        value={newProcess.burstTime}
                        onChange={(e) => setNewProcess({...newProcess, burstTime: e.target.value})}
                        className="w-full p-2 border rounded-lg"
                    />
                </div>
              </div>
              <button 
                onClick={addProcess}
                className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition flex items-center justify-center gap-2"
              >
                <Plus size={16}/> Add
              </button>
            </div>
          </div>

          {/* Right: Process List Display */}
          <div className="lg:col-span-2 flex flex-col h-full">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-grow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Process List</h2>
                <span className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">Count: {processes.length}</span>
              </div>
              
              <div className="overflow-auto max-h-[300px] border rounded-lg mb-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 font-medium text-gray-600 bg-gray-50">Process Name</th>
                      <th className="p-3 font-medium text-gray-600 bg-gray-50">Arrival Time (AT)</th>
                      <th className="p-3 font-medium text-gray-600 bg-gray-50">Burst Time (BT)</th>
                      <th className="p-3 font-medium text-gray-600 bg-gray-50 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processes.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-400">
                                No processes added.
                            </td>
                        </tr>
                    ) : (
                        processes.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 group">
                            <td className="p-3 font-medium flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${getColor(p.id)}`}></div>
                                {p.name}
                            </td>
                            <td className="p-3">{p.arrivalTime}</td>
                            <td className="p-3">{p.burstTime}</td>
                            <td className="p-3 text-right">
                            <button 
                                onClick={() => removeProcess(p.id)}
                                className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition"
                            >
                                <Trash2 size={16} />
                            </button>
                            </td>
                        </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button 
                    onClick={handleCalculate}
                    disabled={processes.length === 0}
                    className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:bg-gray-300"
                >
                    <Play size={18} /> Run Simulation
                </button>
                <button 
                    onClick={reset}
                    className="px-6 py-3 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition"
                >
                    Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Result Area (Gantt Chart & Table) */}
        {simulationResult && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* 4. Gantt Chart Visualization */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <BarChart size={20} className="text-purple-500"/> Gantt Chart
              </h2>
              
              {/* Chart Bar Area */}
              <div className="relative w-full h-24 bg-gray-100 rounded-lg flex overflow-hidden mb-2 border border-gray-200">
                {simulationResult.timeline.length > 0 ? (
                    simulationResult.timeline.map((block, idx) => {
                        const totalDuration = simulationResult.timeline[simulationResult.timeline.length - 1].end;
                        const blockDuration = block.end - block.start;
                        // Calculate percentage
                        const widthPercent = (blockDuration / totalDuration) * 100;
                        
                        return (
                            <div 
                                key={idx}
                                style={{ width: `${widthPercent}%` }}
                                className={`${getColor(block.processId)} h-full flex items-center justify-center text-white text-xs font-bold border-r border-white/20 relative group cursor-default transition-all hover:brightness-110`}
                                title={`P${block.processId}: ${block.start} ~ ${block.end} (Duration: ${blockDuration})`}
                            >
                                P{block.processId}
                                {blockDuration > 1 && (
                                    <span className="absolute bottom-1 text-[10px] opacity-70">{blockDuration}s</span>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No data available.
                    </div>
                )}
              </div>
              
              {/* Time Markers */}
              <div className="relative w-full h-6 text-xs text-gray-400 flex justify-between font-mono">
                 <span>0</span>
                 <span>
                    {simulationResult.timeline.length > 0 
                        ? simulationResult.timeline[simulationResult.timeline.length - 1].end 
                        : 0}
                 </span>
              </div>
            </div>

            {/* 5. Result Table */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <h2 className="text-lg font-semibold mb-4">Detailed Results</h2>
               <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-semibold text-gray-700">Process Name</th>
                            <th className="p-4 font-semibold text-gray-700">Arrival Time (AT)</th>
                            <th className="p-4 font-semibold text-gray-700">Burst Time (BT)</th>
                            <th className="p-4 font-semibold text-blue-700">Completion Time (CT)</th>
                            <th className="p-4 font-semibold text-orange-700">Waiting Time (WT)</th>
                            <th className="p-4 font-semibold text-green-700">Turnaround Time (TT)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {processes.sort((a,b) => a.id - b.id).map(p => {
                            // Use placeholders if result doesn't exist yet
                            const stats = simulationResult.finalStats[p.id] || { completionTime: '-', waitingTime: '-', turnaroundTime: '-' };
                            return (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-medium">
                                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getColor(p.id)}`}></span>
                                        {p.name}
                                    </td>
                                    <td className="p-4 text-gray-600">{p.arrivalTime}</td>
                                    <td className="p-4 text-gray-600">{p.burstTime}</td>
                                    <td className="p-4 font-medium text-blue-600">{stats.completionTime}</td>
                                    <td className="p-4 font-medium text-orange-600">{stats.waitingTime}</td>
                                    <td className="p-4 font-medium text-green-600">{stats.turnaroundTime}</td>
                                </tr>
                            );
                        })}
                        {/* Averages Row */}
                        <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                            <td colSpan={4} className="p-4 text-right text-gray-700">Average:</td>
                            <td className="p-4 text-orange-700">
                                {(Object.values(simulationResult.finalStats).reduce((acc, cur) => acc + cur.waitingTime, 0) / processes.length).toFixed(2)}
                            </td>
                            <td className="p-4 text-green-700">
                                {(Object.values(simulationResult.finalStats).reduce((acc, cur) => acc + cur.turnaroundTime, 0) / processes.length).toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}