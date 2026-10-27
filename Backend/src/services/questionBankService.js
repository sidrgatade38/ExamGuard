/**
 * ExamGuard - Question Bank Service (Module 18)
 *
 * Provides departmental and personal question bank management with
 * strict RBAC, authorization validation, categorization, and audit logging.
 */

const { supabase } = require('../config/supabase');
const auditLogService = require('./auditLogService');
const crypto = require('crypto');

// Standard curriculum question bank seed for Systems Programming & Operating System
const SAMPLE_SPOS_QUESTIONS = [
  // Unit 1: Loaders & Linkers (Marks 8 & 9)
  {
    unit_number: 1,
    unit_title: 'Loaders and Linkers',
    topic: 'Static vs Dynamic Linking',
    question_text: 'Explain Differences between static link library and dynamic link library.',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'MEDIUM',
    answer_scheme: 'Define static linking (.lib/.a) vs dynamic linking (.dll/.so). Memory footprint, execution speed, updateability.',
  },
  {
    unit_number: 1,
    unit_title: 'Loaders and Linkers',
    topic: 'Loader Schemes',
    question_text: 'What are the different types of Loaders? Explain compile and Go loader in detail.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'List Compile & Go, Absolute, Relocating, Direct Linking. Detailed explanation of Compile & Go with advantages/disadvantages.',
  },
  {
    unit_number: 1,
    unit_title: 'Loaders and Linkers',
    topic: 'Loader Schemes',
    question_text: 'List and explain different loader schemes in detail with appropriate architecture diagrams.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Comparative analysis of all 4 major loader architectures with memory map diagrams.',
  },
  {
    unit_number: 1,
    unit_title: 'Loaders and Linkers',
    topic: 'Direct Linking Loader',
    question_text: 'Explain Design of Direct linking loaders and explain required data structures (GSD, ESD, RLD, TXT).',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'MEDIUM',
    answer_scheme: 'Pass 1 and Pass 2 algorithms, ESD table, TXT cards, RLD records, and EXEs.',
  },
  {
    unit_number: 1,
    unit_title: 'Loaders and Linkers',
    topic: 'Relocation & Linking',
    question_text: 'Explain the relocation and linking process in modern operating systems with an example.',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'EASY',
    answer_scheme: 'Address binding, relocation dictionary, dynamic symbol resolution.',
  },
  {
    unit_number: 1,
    unit_title: 'Loaders and Linkers',
    topic: 'Dynamic Linking',
    question_text: 'Explain Procedure Linkage Table (PLT) and Global Offset Table (GOT) in ELF binaries.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Position-independent code (PIC), GOT entries, lazy binding via PLT stubs.',
  },

  // Unit 2: Compilers & Interpreters / Lexical Analysis (Marks 8 & 9)
  {
    unit_number: 2,
    unit_title: 'Compilers, Interpreters and Lexical Analysis',
    topic: 'Compiler vs Interpreter',
    question_text: 'Compare Compilers and Interpreters with respect to translation phases, execution speed, and error diagnostics.',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'EASY',
    answer_scheme: 'Comparison table: source translation, intermediate representation, bytecode execution, debugging ease.',
  },
  {
    unit_number: 2,
    unit_title: 'Compilers, Interpreters and Lexical Analysis',
    topic: 'LEX Tool',
    question_text: 'What is LEX? Explain working of LEX with suitable block diagram and regular expression specifications.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'LEX structure: definitions, rules, user subroutines, yylex() finite automata generation.',
  },
  {
    unit_number: 2,
    unit_title: 'Compilers, Interpreters and Lexical Analysis',
    topic: 'Lexical Analysis Foundations',
    question_text: 'Define token, pattern, lexemes & lexical error. Illustrate with an example assignment statement.',
    question_type: 'SHORT_ANSWER',
    marks: 8,
    difficulty: 'EASY',
    answer_scheme: 'Formal definitions with sample token streams and error recovery techniques.',
  },
  {
    unit_number: 2,
    unit_title: 'Compilers, Interpreters and Lexical Analysis',
    topic: 'Compiler Phases',
    question_text: 'What is a compiler? Explain any two phases of compiler with suitable diagrams and symbol table interactions.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Phases: Analysis vs Synthesis. Detail Syntax Analysis (AST) and Semantic Analysis (Type checking).',
  },
  {
    unit_number: 2,
    unit_title: 'Compilers, Interpreters and Lexical Analysis',
    topic: 'Intermediate Code Generation',
    question_text: 'Explain Quadruples, Triples, and Indirect Triples representations with an example arithmetic expression.',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'MEDIUM',
    answer_scheme: '3-address code representations, operand addressing, compiler optimization implications.',
  },
  {
    unit_number: 2,
    unit_title: 'Compilers, Interpreters and Lexical Analysis',
    topic: 'Code Optimization',
    question_text: 'Explain Machine-Independent code optimization techniques: Common subexpression elimination, loop invariants, and dead code removal.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Control flow graphs, basic blocks, data-flow analysis, and loop unrolling.',
  },

  // Unit 3: Operating System Overview & Process Management (Marks 9 & 9)
  {
    unit_number: 3,
    unit_title: 'Operating System Overview & Process Management',
    topic: 'Process Synchronization',
    question_text: 'What is the need of Process synchronization? Explain Semaphore in detail (Counting vs Binary Semaphore).',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Critical section problem, mutual exclusion, wait() and signal() atomic operations, spinlocks vs sleep-locks.',
  },
  {
    unit_number: 3,
    unit_title: 'Operating System Overview & Process Management',
    topic: 'OS Services',
    question_text: 'What is Operating System? Explain various operating system services in detail (Process, I/O, File, Protection).',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'EASY',
    answer_scheme: 'User interface, program execution, I/O operations, file-system manipulation, communications, error detection.',
  },
  {
    unit_number: 3,
    unit_title: 'Operating System Overview & Process Management',
    topic: 'CPU Scheduling Concepts',
    question_text: 'Explain preemptive and Non preemptive scheduling in detail with criteria like turnaround time and response time.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Dispatcher role, context switching overhead, CPU burst cycles, fairness vs starvation.',
  },
  {
    unit_number: 3,
    unit_title: 'Operating System Overview & Process Management',
    topic: 'Scheduling Algorithms',
    question_text: 'Explain any two scheduling algorithms with suitable example: Round Robin (RR) and Shortest Job First (SJF).',
    question_type: 'NUMERICAL',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Gantt chart calculation, average waiting time, average turnaround time, time quantum trade-offs.',
  },
  {
    unit_number: 3,
    unit_title: 'Operating System Overview & Process Management',
    topic: 'Classic Synchronization Problems',
    question_text: 'Explain the Producer-Consumer problem and its solution using POSIX mutex and counting semaphores.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Bounded buffer problem, race conditions, empty/full semaphore definitions, synchronization code.',
  },
  {
    unit_number: 3,
    unit_title: 'Operating System Overview & Process Management',
    topic: 'Deadlock Handling',
    question_text: 'State the four necessary conditions for deadlock. Explain Deadlock Prevention vs Deadlock Avoidance (Banker\'s Algorithm).',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Mutual exclusion, hold and wait, no preemption, circular wait. Safe state calculation.',
  },

  // Unit 4: Memory Management (Marks 9 & 9)
  {
    unit_number: 4,
    unit_title: 'Memory Management',
    topic: 'Virtual Memory & Paging',
    question_text: 'What is virtual memory management? Explain address translation in paging system with a page table diagram.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Logical vs physical address space, page number, page offset, frame mapping, hardware MMU role.',
  },
  {
    unit_number: 4,
    unit_title: 'Memory Management',
    topic: 'Memory Allocation Strategies',
    question_text: 'Write proper examples and explain memory allocation strategies first fit, best fit and worst fit. Also explain their advantages and disadvantages.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'EASY',
    answer_scheme: 'Dynamic storage allocation problem, external fragmentation, internal fragmentation, comparison table.',
  },
  {
    unit_number: 4,
    unit_title: 'Memory Management',
    topic: 'Page Replacement Algorithms',
    question_text: 'Explain any two page replacement strategies in detail: LRU (Least Recently Used) and Optimal Page Replacement with reference string evaluation.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Belady\'s anomaly, stack algorithms, page fault frequency, comparative hit ratio.',
  },
  {
    unit_number: 4,
    unit_title: 'Memory Management',
    topic: 'Translation Lookaside Buffer (TLB)',
    question_text: 'What is TLB? Explain the paging system with the use of TLB. What are the advantages and effective memory access time formula?',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Associative cache hardware, hit ratio alpha, TLB miss penalty, EAT = (TLB_access + RAM) * alpha + (TLB + 2*RAM) * (1-alpha).',
  },
  {
    unit_number: 4,
    unit_title: 'Memory Management',
    topic: 'Segmentation vs Paging',
    question_text: 'Compare Segmentation and Paging. Explain how Segmentation with Paging provides logical protection and dynamic relocation.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'User view of memory, segment table (base/limit), protection bits, combined segmentation with paging architecture.',
  },
  {
    unit_number: 4,
    unit_title: 'Memory Management',
    topic: 'Thrashing',
    question_text: 'What is Thrashing? Explain Working Set Model and Page Fault Frequency schemes to prevent thrashing.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Degree of multiprogramming vs CPU utilization curve, locality model, working set window delta.',
  },
];

// Standard curriculum question bank seed for Database Management Systems (310241)
const SAMPLE_DBMS_QUESTIONS = [
  // Unit 1: ER Modeling and Relational Database Design
  {
    unit_number: 1,
    unit_title: 'ER Modeling and Relational Database Design',
    topic: 'ER Modeling',
    question_text: 'Explain ER Modeling concepts: Entity, Attributes, Relationships, and Extended ER features with a University schema.',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'MEDIUM',
    answer_scheme: 'Entities, weak entities, generalization, specialization, aggregation, ER-to-relational mapping.',
  },
  {
    unit_number: 1,
    unit_title: 'ER Modeling and Relational Database Design',
    topic: 'Relational Integrity',
    question_text: 'What are integrity constraints in relational databases? Explain Domain, Key, Entity, and Referential Integrity with SQL examples.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Primary key, foreign key, ON DELETE CASCADE, CHECK constraints, schema validation.',
  },
  {
    unit_number: 1,
    unit_title: 'ER Modeling and Relational Database Design',
    topic: 'Relational Algebra',
    question_text: 'Explain fundamental operations in Relational Algebra: Select, Project, Union, Set Difference, Cartesian Product, and Rename with examples.',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'EASY',
    answer_scheme: 'Syntax, mathematical formulation, relational algebra expressions on Employee-Department tables.',
  },
  {
    unit_number: 1,
    unit_title: 'ER Modeling and Relational Database Design',
    topic: 'Join Operations',
    question_text: 'Compare Theta Join, Equi Join, Natural Join, and Outer Joins (Left, Right, Full) with queries and visual Venn diagrams.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Inner vs Outer join semantics, NULL handling, query plans.',
  },

  // Unit 2: SQL, Relational Algebra, and Normalization
  {
    unit_number: 2,
    unit_title: 'SQL, Relational Algebra, and Normalization',
    topic: 'Functional Dependency',
    question_text: 'What is Functional Dependency? Explain Armstrong\'s Axioms and attribute closure computation with an example relation.',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'MEDIUM',
    answer_scheme: 'Reflexivity, Augmentation, Transitivity, attribute closure algorithm X+.',
  },
  {
    unit_number: 2,
    unit_title: 'SQL, Relational Algebra, and Normalization',
    topic: 'Normalization 1NF to BCNF',
    question_text: 'Explain Normalization from 1NF to BCNF with a real-world unnormalized student enrollment relation.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Anomalies in unnormalized relations, 1NF atomic values, 2NF full dependency, 3NF transitive dependency, BCNF superkey condition.',
  },
  {
    unit_number: 2,
    unit_title: 'SQL, Relational Algebra, and Normalization',
    topic: 'Lossless Decomposition',
    question_text: 'Explain the conditions for Lossless Join Decomposition and Dependency Preservation with a step-by-step example.',
    question_type: 'DESCRIPTIVE',
    marks: 8,
    difficulty: 'EASY',
    answer_scheme: 'R1 ∩ R2 -> R1 or R2, intersection is superkey, dependency preservation testing.',
  },
  {
    unit_number: 2,
    unit_title: 'SQL, Relational Algebra, and Normalization',
    topic: 'Multivalued Dependencies & 4NF',
    question_text: 'What is Multivalued Dependency (MVD)? Explain 4th Normal Form (4NF) with an example relation violating 4NF.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Definition of alpha ->-> beta, trivial MVD, 4NF definition, decomposition into 4NF.',
  },

  // Unit 3: Transaction Processing, Concurrency, and ACID
  {
    unit_number: 3,
    unit_title: 'Transaction Processing, Concurrency, and ACID',
    topic: 'ACID Properties',
    question_text: 'Explain ACID properties of transactions in detail and show how the DBMS ensures Atomicity and Durability using Write-Ahead Logging (WAL).',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Atomicity, Consistency, Isolation, Durability, recovery manager, commit protocol.',
  },
  {
    unit_number: 3,
    unit_title: 'Transaction Processing, Concurrency, and ACID',
    topic: 'Serializability',
    question_text: 'What is Serializability? Explain Conflict Serializability and precedence graph (cycle detection) testing with two concurrent schedules.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Conflicting instructions (read-write, write-write), precedence graph construction, cycle detection theorem.',
  },
  {
    unit_number: 3,
    unit_title: 'Transaction Processing, Concurrency, and ACID',
    topic: 'Two-Phase Locking (2PL)',
    question_text: 'Explain Two-Phase Locking (2PL) protocol: Growing phase, Shrinking phase, Strict 2PL, and Rigorous 2PL with lock conversion.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Shared vs Exclusive locks, phase transitions, cascading rollback prevention in Strict 2PL.',
  },
  {
    unit_number: 3,
    unit_title: 'Transaction Processing, Concurrency, and ACID',
    topic: 'Deadlock Handling',
    question_text: 'Explain Deadlock detection, prevention (Wait-Die and Wound-Wait schemes), and recovery in database transaction management.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Wait-for graph, timestamp-based deadlock prevention, victim selection, rollback.',
  },

  // Unit 4: Query Processing, Indexing, and NoSQL
  {
    unit_number: 4,
    unit_title: 'Query Processing, Indexing, and NoSQL',
    topic: 'B+ Tree Indexing',
    question_text: 'Explain structure and properties of B+ Tree Index. Perform step-by-step insertion of keys into a B+ tree of order 4.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Leaf vs non-leaf node layout, linked leaf pointers, split algorithms, search complexity O(log N).',
  },
  {
    unit_number: 4,
    unit_title: 'Query Processing, Indexing, and NoSQL',
    topic: 'Query Optimization',
    question_text: 'Explain the phases of Query Processing: Parsing, Translation, Optimization (Cost-based & Heuristic), and Evaluation.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Relational algebra tree, equivalence rules, push selection down, cost estimation formulas.',
  },
  {
    unit_number: 4,
    unit_title: 'Query Processing, Indexing, and NoSQL',
    topic: 'Hashing Techniques',
    question_text: 'Compare Static Hashing and Dynamic Hashing (Extendible Hashing). Explain directory and bucket splitting in Extendible Hashing.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'MEDIUM',
    answer_scheme: 'Global depth, local depth, directory doubling, overflow handling.',
  },
  {
    unit_number: 4,
    unit_title: 'Query Processing, Indexing, and NoSQL',
    topic: 'CAP Theorem & NoSQL',
    question_text: 'Explain CAP Theorem (Consistency, Availability, Partition Tolerance) and BASE properties. Compare SQL vs Document, Key-Value, and Columnar NoSQL stores.',
    question_type: 'DESCRIPTIVE',
    marks: 9,
    difficulty: 'HARD',
    answer_scheme: 'Brewer\'s CAP theorem trade-offs, network partition reality, eventual consistency, schema-less advantages.',
  },
];

// Fallback in-memory cache if database migration has not been run yet
const memoryQuestionBank = new Map();

function isTableMissingError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  return (
    code === '42P01' ||
    code.startsWith('PGRST') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('relation')
  );
}

/**
 * Normalizes question object
 */
function normalizeQuestion(q) {
  return {
    id: q.id,
    authorId: q.author_id,
    subject: q.subject,
    course: q.course,
    semester: q.semester,
    academicPattern: q.academic_pattern,
    examType: q.exam_type,
    unitNumber: q.unit_number,
    unitTitle: q.unit_title,
    topic: q.topic,
    questionText: q.question_text,
    questionType: q.question_type,
    marks: q.marks,
    difficulty: q.difficulty,
    answerScheme: q.answer_scheme,
    approvalStatus: q.approval_status,
    isActive: q.is_active,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  };
}

/**
 * Retrieves questions with filtering and authorization boundaries.
 */
async function getQuestions({
  authorId,
  role,
  subject,
  semester,
  unitNumber,
  difficulty,
  questionType,
  approvalStatus,
  search,
  limit = 100,
  offset = 0,
}) {
  try {
    let query = supabase
      .from('question_bank')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (subject) query = query.ilike('subject', `%${subject.trim()}%`);
    if (semester) query = query.eq('semester', semester.trim());
    if (unitNumber) query = query.eq('unit_number', parseInt(unitNumber, 10));
    if (difficulty) query = query.eq('difficulty', difficulty.toUpperCase());
    if (questionType) query = query.eq('question_type', questionType.toUpperCase());

    // Role-based filtering
    if (role === 'TEACHER') {
      // Teachers can see APPROVED questions from any author, plus their own drafts/pending
      if (approvalStatus) {
        query = query.eq('approval_status', approvalStatus.toUpperCase());
      } else {
        query = query.or(`approval_status.eq.APPROVED,author_id.eq.${authorId}`);
      }
    } else if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus.toUpperCase());
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`question_text.ilike.${term},topic.ilike.${term},unit_title.ilike.${term}`);
    }

    query = query
      .order('unit_number', { ascending: true })
      .order('marks', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      // If table doesn't exist yet, return in-memory items
      if (isTableMissingError(error)) {
        return getMemoryQuestions({ authorId, role, subject, unitNumber, difficulty, questionType, approvalStatus });
      }
      throw error;
    }

    return {
      success: true,
      data: (data || []).map(normalizeQuestion),
      totalCount: count || (data ? data.length : 0),
    };
  } catch (err) {
    if (isTableMissingError(err)) {
      return getMemoryQuestions({ authorId, role, subject, unitNumber, difficulty, questionType, approvalStatus });
    }
    console.error('[QuestionBankService] getQuestions error:', err.message);
    throw err;
  }
}

/**
 * Memory fallback when database tables are awaiting migration execution
 */
function getMemoryQuestions({ authorId, role, subject, unitNumber, difficulty, questionType, approvalStatus }) {
  let list = Array.from(memoryQuestionBank.values()).filter((q) => q.is_active);

  if (subject) {
    list = list.filter((q) => q.subject.toLowerCase().includes(subject.toLowerCase().trim()));
  }
  if (unitNumber) {
    list = list.filter((q) => q.unit_number === parseInt(unitNumber, 10));
  }
  if (difficulty) {
    list = list.filter((q) => q.difficulty === difficulty.toUpperCase());
  }
  if (questionType) {
    list = list.filter((q) => q.question_type === questionType.toUpperCase());
  }
  if (approvalStatus) {
    list = list.filter((q) => q.approval_status === approvalStatus.toUpperCase());
  } else if (role === 'TEACHER') {
    list = list.filter((q) => q.approval_status === 'APPROVED' || q.author_id === authorId);
  }

  return {
    success: true,
    data: list.map(normalizeQuestion),
    totalCount: list.length,
    isMemoryStore: true,
  };
}

/**
 * Creates a new question in the question bank.
 */
async function createQuestion({
  authorId,
  subject,
  course = 'Computer Engineering',
  semester = 'Semester 5',
  academicPattern = '2019 Pattern',
  examType = 'End Semester Examination',
  unitNumber,
  unitTitle,
  topic = '',
  questionText,
  questionType = 'DESCRIPTIVE',
  marks,
  difficulty = 'MEDIUM',
  answerScheme = '',
  approvalStatus = 'APPROVED',
}) {
  if (!authorId) throw new Error('Author identity is required.');
  if (!subject || !subject.trim()) throw new Error('Subject is required.');
  if (!unitNumber || isNaN(unitNumber)) throw new Error('Valid unit number (1-10) is required.');
  if (!unitTitle || !unitTitle.trim()) throw new Error('Unit title is required.');
  if (!questionText || !questionText.trim()) throw new Error('Question text is required.');
  if (!marks || isNaN(marks) || marks <= 0) throw new Error('Valid marks (greater than 0) are required.');

  const payload = {
    id: crypto.randomUUID(),
    author_id: authorId,
    subject: subject.trim(),
    course: course.trim(),
    semester: semester.trim(),
    academic_pattern: academicPattern.trim(),
    exam_type: examType.trim(),
    unit_number: parseInt(unitNumber, 10),
    unit_title: unitTitle.trim(),
    topic: topic ? topic.trim() : null,
    question_text: questionText.trim(),
    question_type: questionType.toUpperCase(),
    marks: parseInt(marks, 10),
    difficulty: difficulty.toUpperCase(),
    answer_scheme: answerScheme ? answerScheme.trim() : null,
    approval_status: approvalStatus.toUpperCase(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('question_bank')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      if (isTableMissingError(error)) {
        memoryQuestionBank.set(payload.id, payload);
        return normalizeQuestion(payload);
      }
      throw error;
    }

    return normalizeQuestion(data);
  } catch (err) {
    if (isTableMissingError(err)) {
      memoryQuestionBank.set(payload.id, payload);
      return normalizeQuestion(payload);
    }
    console.error('[QuestionBankService] createQuestion error:', err.message);
    throw err;
  }
}

/**
 * Updates an existing question bank entry. Only original author or ADMIN can update.
 */
async function updateQuestion(id, updates, authorId, role) {
  if (!id) throw new Error('Question ID is required.');

  // Fetch existing
  let existing = null;
  try {
    const { data } = await supabase.from('question_bank').select('*').eq('id', id).maybeSingle();
    existing = data;
  } catch (err) {
    existing = memoryQuestionBank.get(id);
  }

  if (!existing) {
    existing = memoryQuestionBank.get(id);
  }

  if (!existing) {
    const err = new Error('Question not found.');
    err.statusCode = 404;
    throw err;
  }

  if (role !== 'ADMIN' && existing.author_id !== authorId) {
    const err = new Error('Unauthorized: You can only edit questions authored by your account.');
    err.statusCode = 403;
    throw err;
  }

  // Prevent author_id spoofing
  delete updates.author_id;
  delete updates.authorId;
  delete updates.id;

  const updatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (updates.subject !== undefined) updatePayload.subject = updates.subject;
  if (updates.course !== undefined) updatePayload.course = updates.course;
  if (updates.semester !== undefined) updatePayload.semester = updates.semester;
  if (updates.academicPattern !== undefined || updates.academic_pattern !== undefined)
    updatePayload.academic_pattern = updates.academicPattern !== undefined ? updates.academicPattern : updates.academic_pattern;
  if (updates.examType !== undefined || updates.exam_type !== undefined)
    updatePayload.exam_type = updates.examType !== undefined ? updates.examType : updates.exam_type;
  if (updates.unitNumber !== undefined || updates.unit_number !== undefined)
    updatePayload.unit_number = updates.unitNumber !== undefined ? parseInt(updates.unitNumber, 10) : updates.unit_number;
  if (updates.unitTitle !== undefined || updates.unit_title !== undefined)
    updatePayload.unit_title = updates.unitTitle !== undefined ? updates.unitTitle : updates.unit_title;
  if (updates.topic !== undefined) updatePayload.topic = updates.topic;
  if (updates.questionText !== undefined || updates.question_text !== undefined)
    updatePayload.question_text = updates.questionText !== undefined ? updates.questionText : updates.question_text;
  if (updates.questionType !== undefined || updates.question_type !== undefined)
    updatePayload.question_type = (updates.questionType || updates.question_type).toUpperCase();
  if (updates.marks !== undefined) updatePayload.marks = parseInt(updates.marks, 10);
  if (updates.difficulty !== undefined) updatePayload.difficulty = updates.difficulty.toUpperCase();
  if (updates.answerScheme !== undefined || updates.answer_scheme !== undefined)
    updatePayload.answer_scheme = updates.answerScheme !== undefined ? updates.answerScheme : updates.answer_scheme;
  if (updates.approvalStatus !== undefined || updates.approval_status !== undefined)
    updatePayload.approval_status = (updates.approvalStatus || updates.approval_status).toUpperCase();
  if (updates.isActive !== undefined || updates.is_active !== undefined)
    updatePayload.is_active = updates.isActive !== undefined ? updates.isActive : updates.is_active;

  try {
    const { data, error } = await supabase
      .from('question_bank')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (memoryQuestionBank.has(id)) {
        const updated = { ...memoryQuestionBank.get(id), ...updatePayload };
        memoryQuestionBank.set(id, updated);
        return normalizeQuestion(updated);
      }
      throw error;
    }

    return normalizeQuestion(data);
  } catch (err) {
    if (memoryQuestionBank.has(id)) {
      const updated = { ...memoryQuestionBank.get(id), ...updatePayload };
      memoryQuestionBank.set(id, updated);
      return normalizeQuestion(updated);
    }
    throw err;
  }
}

/**
 * Seeds sample university curriculum questions
 * for rapid testing and demonstration.
 */
async function seedSampleQuestions(authorId, subject = 'Systems Programming and Operating System') {
  const isDBMS = subject.toLowerCase().includes('database') || subject.toLowerCase().includes('dbms');
  const sourceQuestions = isDBMS ? SAMPLE_DBMS_QUESTIONS : SAMPLE_SPOS_QUESTIONS;
  const targetSubject = isDBMS ? 'Database Management Systems' : 'Systems Programming and Operating System';

  const seeded = [];
  for (const q of sourceQuestions) {
    const created = await createQuestion({
      authorId,
      subject: targetSubject,
      course: 'T.E. (Computer Engineering)',
      semester: 'Semester 5',
      academicPattern: '2019 Pattern',
      examType: 'End Semester Examination',
      unitNumber: q.unit_number,
      unitTitle: q.unit_title,
      topic: q.topic,
      questionText: q.question_text,
      questionType: q.question_type,
      marks: q.marks,
      difficulty: q.difficulty,
      answerScheme: q.answer_scheme,
      approvalStatus: 'APPROVED',
    });
    seeded.push(created);
  }

  await auditLogService.logAuditEvent({
    userId: authorId,
    role: 'TEACHER',
    action: 'QUESTION_PAPER_CREATED',
    resourceType: 'QUESTION_BANK',
    outcome: 'SUCCESS',
    summary: `Seeded ${seeded.length} standard curriculum questions for "${targetSubject}" into Question Bank.`,
  });

  return seeded;
}

module.exports = {
  getQuestions,
  createQuestion,
  updateQuestion,
  seedSampleQuestions,
  normalizeQuestion,
  SAMPLE_SPOS_QUESTIONS,
  SAMPLE_DBMS_QUESTIONS,
};
