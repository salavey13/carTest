/* ═══════════════════════════════════════════════════════════════════════════════════
   English 7 VPR — Question Banks + Reference Data
   "Stripper pole" design: focused VPR practice with real exam-style questions
   ═══════════════════════════════════════════════════════════════════════════════════ */

// ─── Shared types ─────────────────────────────────────────────────────────────────

export type VPRType = 'listening' | 'reading' | 'grammar' | 'email';

export interface ChoiceQuestion {
  letter: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// ─── Type 1: Listening Comprehension ────────────────────────────────────────────

export interface ListeningSet {
  id: number;
  vprType: string;
  title: string;
  transcript: string;
  questions: ChoiceQuestion[];  // 3 options each
  answerKey: string;  // e.g. "22311"
}

export const LISTENING_SETS: ListeningSet[] = [
  {
    id: 1,
    vprType: 'Тип 1 № 3963',
    title: 'Dialogue — At the Cinema',
    transcript: `— Hi Zoe! How are you?\n— Hi Eric! I'm fine, thanks. Do you want to go to the cinema on Saturday?\n— Sure! What film are we going to see?\n— "A True Friend". My grandmother told me about it. She watched it last week and loved it!\n— Oh, I've heard about that film. It's about a dog, right?\n— Yes, it is! The dog helps a boy find his way home. It's really touching.\n— Great! Where should we meet?\n— Let's meet in the park, near the fountain. At about five o'clock?\n— OK, but the film begins at 5:30 pm. Maybe we should meet at five to be safe.\n— Good idea! By the way, can I have your phone number?\n— Of course! It's 255-473.\n— Thanks! See you on Saturday, Zoe!\n— See you, Eric!`,
    questions: [
      {
        letter: 'A',
        question: 'Zoe is going to go shopping with her _________ on Saturday.',
        options: ['cousin', 'grandmother', 'grandfather'],
        correctIndex: 1,
        explanation: 'Zoe says: "My grandmother told me about it. She watched it last week and loved it!" — she is going to the cinema with Eric, but she heard about the film from her grandmother.',
      },
      {
        letter: 'B',
        question: 'The film "A True Friend" is about _________.',
        options: ['two boys', 'a dog', 'an accident'],
        correctIndex: 1,
        explanation: 'Eric asks: "It\'s about a dog, right?" and Zoe confirms: "Yes, it is! The dog helps a boy find his way home."',
      },
      {
        letter: 'C',
        question: 'Zoe and Eric will meet _________.',
        options: ['by the entrance to the cinema', 'behind the park', 'in the park'],
        correctIndex: 2,
        explanation: 'Zoe says: "Let\'s meet in the park, near the fountain."',
      },
      {
        letter: 'D',
        question: 'The film begins at _________.',
        options: ['5:30 pm', '5:00 pm', '6:30 pm'],
        correctIndex: 0,
        explanation: 'Eric says: "the film begins at 5:30 pm. Maybe we should meet at five to be safe."',
      },
      {
        letter: 'E',
        question: 'Zoe\'s phone number is _________.',
        options: ['255-473', '255-374', '255-437'],
        correctIndex: 0,
        explanation: 'Eric asks for Zoe\'s number and she says: "It\'s 255-473."',
      },
    ],
    answerKey: '22311',
  },
  {
    id: 2,
    vprType: 'Тип 1 № 3964',
    title: 'Dialogue — School Project',
    transcript: `— Hello, Emma! Have you done your history project yet?\n— Not yet, Tom. I'm going to the library after school today. Do you want to come with me?\n— I'd love to, but I have football practice until four o'clock. Can we meet at the library at half past four?\n— That's perfect! I need to find information about Ancient Egypt. What's your topic?\n— The Romans. I started reading a book about Julius Caesar yesterday. It's really interesting!\n— Oh, I love history! By the way, Mrs. Brown said we need to bring pictures for our projects.\n— I know. I printed some pictures of the pyramids this morning. They look great!\n— Cool! Do you need any help with the presentation?\n— That would be nice. Can you help me on Thursday after school?\n— Sure, no problem! I'll bring my laptop too.\n— Thanks, Tom! You're the best!`,
    questions: [
      {
        letter: 'A',
        question: 'Emma is going to the _________ after school.',
        options: ['museum', 'library', 'cinema'],
        correctIndex: 1,
        explanation: 'Emma says: "I\'m going to the library after school today."',
      },
      {
        letter: 'B',
        question: 'Tom has football practice until _________.',
        options: ['three o\'clock', 'four o\'clock', 'five o\'clock'],
        correctIndex: 1,
        explanation: 'Tom says: "I have football practice until four o\'clock."',
      },
      {
        letter: 'C',
        question: 'Tom\'s history project is about _________.',
        options: ['Ancient Egypt', 'The Romans', 'Ancient Greece'],
        correctIndex: 1,
        explanation: 'Tom says: "The Romans. I started reading a book about Julius Caesar yesterday."',
      },
      {
        letter: 'D',
        question: 'Emma printed pictures of the _________.',
        options: ['Roman army', 'pyramids', 'Colosseum'],
        correctIndex: 1,
        explanation: 'Emma says: "I printed some pictures of the pyramids this morning."',
      },
      {
        letter: 'E',
        question: 'Emma and Tom are going to work together on _________.',
        options: ['Tuesday', 'Wednesday', 'Thursday'],
        correctIndex: 2,
        explanation: 'Emma asks: "Can you help me on Thursday after school?" and Tom agrees.',
      },
    ],
    answerKey: '22223',
  },
  {
    id: 3,
    vprType: 'Тип 1 № 3965',
    title: 'Dialogue — Birthday Party',
    transcript: `— Hi Sophie! What are you doing on Sunday?\n— Hi Alex! I'm organising my brother's birthday party. He's turning ten!\n— That's exciting! Is it going to be a big party?\n— Not too big. About fifteen children from his class. We're having it in the garden.\n— In the garden? Isn't it too cold in November?\n— Oh, we have a big tent! My dad put it up yesterday. And we're going to make hot chocolate.\n— Sounds great! What time does the party start?\n— At two o'clock. But I need help with the decorations in the morning. Can you come at ten?\n— Of course! I love decorating. What should I bring?\n— Maybe some balloons? We already have the cake — mum made it last night. It's a chocolate cake with strawberries!\n— Yummy! I'll bring red and blue balloons to match the party theme.\n— Perfect! Oh, and can you bring your music speaker? We need some good music for the games.\n— No problem! See you on Sunday, Sophie!\n— See you, Alex! Thanks for helping!`,
    questions: [
      {
        letter: 'A',
        question: 'Sophie\'s brother is turning _________.',
        options: ['eight', 'nine', 'ten'],
        correctIndex: 2,
        explanation: 'Sophie says: "He\'s turning ten!"',
      },
      {
        letter: 'B',
        question: 'The party is going to be in the _________.',
        options: ['house', 'garden', 'park'],
        correctIndex: 1,
        explanation: 'Sophie says: "We\'re having it in the garden." with a tent.',
      },
      {
        letter: 'C',
        question: 'The party starts at _________.',
        options: ['one o\'clock', 'two o\'clock', 'three o\'clock'],
        correctIndex: 1,
        explanation: 'Sophie says: "At two o\'clock. But I need help with the decorations in the morning."',
      },
      {
        letter: 'D',
        question: 'The birthday cake has _________.',
        options: ['chocolate and cream', 'chocolate and strawberries', 'vanilla and strawberries'],
        correctIndex: 1,
        explanation: 'Sophie says: "It\'s a chocolate cake with strawberries!"',
      },
      {
        letter: 'E',
        question: 'Sophie asks Alex to bring a _________.',
        options: ['camera', 'music speaker', 'present'],
        correctIndex: 1,
        explanation: 'Sophie asks: "Can you bring your music speaker? We need some good music for the games."',
      },
    ],
    answerKey: '32222',
  },
];

// ─── Type 2: Reading Comprehension ──────────────────────────────────────────────

export interface ReadingSet {
  id: number;
  vprType: string;
  title: string;
  passage: string;
  questions: ChoiceQuestion[];  // 4 options each
  answerKey: string;
}

export const READING_SETS: ReadingSet[] = [
  {
    id: 1,
    vprType: 'Тип 2 № 4023',
    title: 'The Football Player',
    passage: `After a month, as the nightmares continued to disturb my nights, it seemed necessary for me to take stock of the situation. I was a good student; the only thing I lacked was knowledge about football in order to fit in with the class. The classmates were nice overall, even if they always chose me last when we formed teams for the playground matches.

As JP used to say:

— You are talented with your head, but when it comes to your legs, it's quite a disaster!

He was right. Impossible to control the ball properly; my passes systematically ended up with the opponent, not to mention my dribbling attempts since I got so mixed up that I ended up on the ground...

I perfected my education by reading all the football magazines that the newsagent on the corner of the street had.`,
    questions: [
      {
        letter: 'A',
        question: 'What kind of student was the hero of the text?',
        options: ['a good student', 'an average student', 'a very good student', 'a bad student'],
        correctIndex: 0,
        explanation: 'The text says directly: "I was a good student."',
      },
      {
        letter: 'B',
        question: 'What were the main character\'s classmates like?',
        options: ['the classmates were nice', 'the classmates were kind', 'the classmates were mean', 'the classmates were good'],
        correctIndex: 0,
        explanation: 'The text says: "The classmates were nice overall." The exact word used is "nice."',
      },
      {
        letter: 'C',
        question: 'I was a good student; the only thing I lacked was knowledge in the area of ... to fit into the class.',
        options: ['mathematics', 'football', 'volleyball', 'reading'],
        correctIndex: 1,
        explanation: 'The text says: "the only thing I lacked was knowledge about football in order to fit in with the class."',
      },
      {
        letter: 'D',
        question: 'I perfected my education by reading all the ... about football.',
        options: ['magazines', 'books', 'texts', 'article texts'],
        correctIndex: 0,
        explanation: 'The text says: "reading all the football magazines that the newsagent on the corner of the street had."',
      },
      {
        letter: 'E',
        question: 'Where was the newsagent?',
        options: ['near the house', 'in the neighbouring street', 'on the corner of the street', 'at the end of the street'],
        correctIndex: 2,
        explanation: 'The text says: "the newsagent on the corner of the street."',
      },
    ],
    answerKey: '11213',
  },
  {
    id: 2,
    vprType: 'Тип 2 № 4024',
    title: 'A Visit to the Zoo',
    passage: `Last Sunday our class went to the city zoo. We arrived early in the morning because our teacher, Mr. Harris, wanted us to see the feeding time. The first animals we visited were the monkeys. They were very funny — they jumped from branch to branch and made funny faces at us.

Then we went to see the elephants. I was surprised to learn that elephants can live for up to seventy years! The baby elephant was especially cute. It was playing with a big ball and spraying water with its trunk.

My favourite part of the trip was the aquarium. There were hundreds of different fish in all colours of the rainbow. The guide told us that some fish can change their colour to hide from predators. I didn't know that before!

We had lunch near the penguin enclosure. The penguins were swimming and diving in the water. One penguin came very close to the glass and looked at us. It seemed like it was smiling!

Mr. Harris gave us a quiz about the animals on the bus ride back to school. I got most of the answers right because I listened carefully to the guide. I want to visit the zoo again soon.`,
    questions: [
      {
        letter: 'A',
        question: 'Why did the class arrive at the zoo early?',
        options: ['to see the feeding time', 'to buy tickets', 'to meet the guide', 'to have breakfast'],
        correctIndex: 0,
        explanation: 'The text says: "We arrived early in the morning because our teacher, Mr. Harris, wanted us to see the feeding time."',
      },
      {
        letter: 'B',
        question: 'What surprised the narrator about elephants?',
        options: ['how fast they can run', 'how long they can live', 'how much they eat', 'how big they are'],
        correctIndex: 1,
        explanation: 'The text says: "I was surprised to learn that elephants can live for up to seventy years!"',
      },
      {
        letter: 'C',
        question: 'What was the narrator\'s favourite part of the trip?',
        options: ['the monkey enclosure', 'the elephant house', 'the aquarium', 'the penguin area'],
        correctIndex: 2,
        explanation: 'The text says: "My favourite part of the trip was the aquarium."',
      },
      {
        letter: 'D',
        question: 'Some fish can change their colour to _________.',
        options: ['attract other fish', 'hide from predators', 'show they are angry', 'find food'],
        correctIndex: 1,
        explanation: 'The text says: "The guide told us that some fish can change their colour to hide from predators."',
      },
      {
        letter: 'E',
        question: 'The class had lunch near the _________.',
        options: ['monkey enclosure', 'elephant house', 'aquarium', 'penguin enclosure'],
        correctIndex: 3,
        explanation: 'The text says: "We had lunch near the penguin enclosure."',
      },
    ],
    answerKey: '12324',
  },
  {
    id: 3,
    vprType: 'Тип 2 № 4025',
    title: 'My Pen Friend',
    passage: `I have been writing to my pen friend, Marco, for two years now. He lives in a small town near Rome, in Italy. We started writing to each other when our English teacher organised a pen friend project at school.

Marco is the same age as me — we are both thirteen. He has dark hair and brown eyes. He loves playing football and supports the Italian national team. Every time there is an important match, he writes me a long email about it!

In his last letter, Marco told me about his school trip to Venice. He went there with his classmates last month. He said that Venice was the most beautiful city he had ever seen. He sent me a photo of himself on a gondola — it looked amazing! He also wrote about the delicious Italian food, especially the pizza and ice cream.

I have never been to Italy, but I hope to go there one day. Marco says his family would be happy to invite me for the summer holidays. My parents think it's a great idea. I am already saving my pocket money for the trip!

Writing to a pen friend is a wonderful way to learn about other countries and practise English at the same time. I recommend it to everyone!`,
    questions: [
      {
        letter: 'A',
        question: 'How long have the narrator and Marco been pen friends?',
        options: ['one year', 'two years', 'three years', 'five years'],
        correctIndex: 1,
        explanation: 'The text says: "I have been writing to my pen friend, Marco, for two years now."',
      },
      {
        letter: 'B',
        question: 'Where does Marco live?',
        options: ['in Rome', 'near Rome', 'in Venice', 'near Milan'],
        correctIndex: 1,
        explanation: 'The text says: "He lives in a small town near Rome, in Italy."',
      },
      {
        letter: 'C',
        question: 'What sport does Marco love?',
        options: ['tennis', 'basketball', 'swimming', 'football'],
        correctIndex: 3,
        explanation: 'The text says: "He loves playing football and supports the Italian national team."',
      },
      {
        letter: 'D',
        question: 'Marco went on a school trip to _________.',
        options: ['Florence', 'Rome', 'Venice', 'Milan'],
        correctIndex: 2,
        explanation: 'The text says: "Marco told me about his school trip to Venice."',
      },
      {
        letter: 'E',
        question: 'The narrator is saving _________ for the trip.',
        options: ['birthday money', 'pocket money', 'holiday money', 'lunch money'],
        correctIndex: 1,
        explanation: 'The text says: "I am already saving my pocket money for the trip!"',
      },
    ],
    answerKey: '22432',
  },
];

// ─── Type 3: Grammar Gap-Fill ───────────────────────────────────────────────────

export interface GrammarGap {
  letter: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  rule: string;  // short grammar rule name
}

export interface GrammarSet {
  id: number;
  vprType: string;
  title: string;
  template: string;  // text with {{A}}, {{B}}, etc. markers
  gaps: GrammarGap[];
  fullText: string;  // correct completed text
  answerKey: string;
}

export const GRAMMAR_SETS: GrammarSet[] = [
  {
    id: 1,
    vprType: 'Тип 3 № 3965',
    title: 'Sweets',
    template: `Many people eat sweets. A sweet is usually made from sugar and water with flavours and other ingredients. People {{A}} sweets for thousands of years. In the past people {{B}} honey to make sweets.

Sweets are found in almost any store because they {{C}} by many companies. Many people think that sweets taste good. Other people do not like {{D}}. Sweets contain lots of sugar, so they are not very healthy. But they are one of the {{E}} kinds of food.`,
    gaps: [
      {
        letter: 'A',
        options: ['like', 'liked', 'has liked', 'have liked'],
        correctIndex: 3,
        explanation: '"People" is plural, so we need "have" (not "has"). Present Perfect is used for actions that started in the past and continue to the present — people have been eating sweets "for thousands of years."',
        rule: 'Present Perfect (have/has + V3)',
      },
      {
        letter: 'B',
        options: ['are using', 'use', 'used', 'have used'],
        correctIndex: 2,
        explanation: '"In the past" signals Past Simple. We use V2/ed form. "Used" is the past form of "use."',
        rule: 'Past Simple',
      },
      {
        letter: 'C',
        options: ['are made', 'are making', 'is making', 'is made'],
        correctIndex: 0,
        explanation: 'Passive voice: "they" (sweets) are made (by companies). Plural subject "they" + "are" + past participle "made."',
        rule: 'Passive Voice (am/is/are + V3)',
      },
      {
        letter: 'D',
        options: ['they', 'them', 'their', 'theirs'],
        correctIndex: 1,
        explanation: '"Do not like" needs an object pronoun. "Them" is the object form of "they." After verbs, we use object pronouns (me, him, her, us, them).',
        rule: 'Object Pronouns',
      },
      {
        letter: 'E',
        options: ['much popular', 'more popular', 'many popular', 'most popular'],
        correctIndex: 3,
        explanation: 'Superlative degree: "one of the most popular" with "the" and "one of the." Long adjective "popular" (3 syllables) uses "the most."',
        rule: 'Superlative Degree',
      },
    ],
    fullText: `Many people eat sweets. A sweet is usually made from sugar and water with flavours and other ingredients. People have liked sweets for thousands of years. In the past people used honey to make sweets.

Sweets are found in almost any store because they are made by many companies. Many people think that sweets taste good. Other people do not like them. Sweets contain lots of sugar, so they are not very healthy. But they are one of the most popular kinds of food.`,
    answerKey: '43124',
  },
  {
    id: 2,
    vprType: 'Тип 3 № 3966',
    title: 'The Amazon Rainforest',
    template: `The Amazon rainforest {{A}} the largest tropical rainforest in the world. It {{B}} in South America and {{C}} nine different countries.

Millions of animals and plants {{D}} in the Amazon. Unfortunately, people {{E}} down many trees every year. Scientists say that if we don't protect the rainforest, many species will disappear.`,
    gaps: [
      {
        letter: 'A',
        options: ['am', 'is', 'are', 'be'],
        correctIndex: 1,
        explanation: '"The Amazon rainforest" is singular (it), so we use "is." The sentence is a fact, so Present Simple.',
        rule: 'Present Simple (to be)',
      },
      {
        letter: 'B',
        options: ['locate', 'located', 'is located', 'locates'],
        correctIndex: 2,
        explanation: 'Passive voice: the rainforest is located (by nature) in South America. Present Simple passive: is + V3.',
        rule: 'Passive Voice',
      },
      {
        letter: 'C',
        options: ['cover', 'covers', 'covering', 'covered'],
        correctIndex: 1,
        explanation: '"It" (the rainforest) is singular, so we add -s to the verb: "covers." Present Simple.',
        rule: 'Present Simple (V-s/es)',
      },
      {
        letter: 'D',
        options: ['live', 'lives', 'lived', 'living'],
        correctIndex: 0,
        explanation: '"Millions of animals and plants" is plural, so we use the base form "live" without -s. Present Simple fact.',
        rule: 'Present Simple',
      },
      {
        letter: 'E',
        options: ['cut', 'cuts', 'are cutting', 'cutting'],
        correctIndex: 0,
        explanation: '"People" is a plural subject — it takes V1 without -s. "People cut down many trees" is correct (Present Simple, plural). Do NOT add -s for "people."',
        rule: 'Present Simple (plural subject: people + V1)',
      },
    ],
    fullText: `The Amazon rainforest is the largest tropical rainforest in the world. It is located in South America and covers nine different countries.

Millions of animals and plants live in the Amazon. Unfortunately, people cut down many trees every year. Scientists say that if we don't protect the rainforest, many species will disappear.`,
    answerKey: '23211',
  },
  {
    id: 3,
    vprType: 'Тип 3 № 3967',
    title: 'A Day at School',
    template: `Yesterday {{A}} a typical school day for Emily. She {{B}} up at seven o'clock and {{C}} a shower. Then she had breakfast with her family.

At school, the first lesson {{D}} maths. Emily is good at maths, so it {{E}} her favourite subject. After lunch, she played volleyball with her friends in the schoolyard.`,
    gaps: [
      {
        letter: 'A',
        options: ['is', 'was', 'were', 'been'],
        correctIndex: 1,
        explanation: '"Yesterday" signals Past Simple. "It" (a day) is singular → "was."',
        rule: 'Past Simple (to be)',
      },
      {
        letter: 'B',
        options: ['wake', 'woke', 'wakes', 'waking'],
        correctIndex: 1,
        explanation: 'Past Simple of "wake" is "woke" (irregular verb). "Yesterday" signals past tense.',
        rule: 'Past Simple (irregular verbs)',
      },
      {
        letter: 'C',
        options: ['take', 'takes', 'took', 'taking'],
        correctIndex: 2,
        explanation: 'Past Simple of "take" is "took" (irregular verb). Sequence of past actions: woke up → took a shower → had breakfast.',
        rule: 'Past Simple (irregular verbs)',
      },
      {
        letter: 'D',
        options: ['is', 'are', 'was', 'were'],
        correctIndex: 2,
        explanation: '"The first lesson" is singular, Past Simple → "was."',
        rule: 'Past Simple (to be)',
      },
      {
        letter: 'E',
        options: ['is', 'are', 'was', 'were'],
        correctIndex: 0,
        explanation: 'Despite the narrative being in the past ("Yesterday"), the sentence "Emily is good at maths, so it is her favourite subject" expresses a general/factual statement about Emily, which uses Present Simple.',
        rule: 'Present Simple (general facts)',
      },
    ],
    fullText: `Yesterday was a typical school day for Emily. She woke up at seven o'clock and took a shower. Then she had breakfast with her family.

At school, the first lesson was maths. Emily is good at maths, so it is her favourite subject. After lunch, she played volleyball with her friends in the schoolyard.`,
    answerKey: '22331',
  },
  {
    id: 4,
    vprType: 'Тип 3 № 3968',
    title: 'My Best Friend',
    template: `My best friend {{A}} called Sarah. We {{B}} friends since we were five years old. She {{C}} in the house next to mine.

Sarah is {{D}} girl in our class. She is {{E}} at drawing than I am, but I am better at maths. We help each other with homework every day.`,
    gaps: [
      {
        letter: 'A',
        options: ['am', 'is', 'are', 'be'],
        correctIndex: 1,
        explanation: '"My best friend" is singular (third person), so we use "is." Present Simple.',
        rule: 'Present Simple (to be)',
      },
      {
        letter: 'B',
        options: ['are', 'were', 'have been', 'had been'],
        correctIndex: 2,
        explanation: '"Since we were five" signals an action that started in the past and continues to the present → Present Perfect: "have been."',
        rule: 'Present Perfect',
      },
      {
        letter: 'C',
        options: ['live', 'lives', 'lived', 'living'],
        correctIndex: 1,
        explanation: '"She" is third person singular → Present Simple with -s: "lives." A permanent fact about where Sarah lives.',
        rule: 'Present Simple (V-s/es)',
      },
      {
        letter: 'D',
        options: ['taller', 'the tallest', 'tallest', 'the most tall'],
        correctIndex: 1,
        explanation: 'Superlative with "the" + adjective + -est. "The tallest girl" = самая высокая девочка.',
        rule: 'Superlative Degree',
      },
      {
        letter: 'E',
        options: ['good', 'better', 'best', 'the best'],
        correctIndex: 1,
        explanation: 'Comparative degree: "better at drawing than I am." We compare two people (Sarah vs narrator) → comparative, not superlative.',
        rule: 'Comparative Degree (irregular)',
      },
    ],
    fullText: `My best friend is called Sarah. We have been friends since we were five years old. She lives in the house next to mine.

Sarah is the tallest girl in our class. She is better at drawing than I am, but I am better at maths. We help each other with homework every day.`,
    answerKey: '23222',
  },
];

// ─── Type 4: Email Writing ──────────────────────────────────────────────────────

export interface EmailTask {
  id: number;
  vprType: string;
  from: { name: string; email: string };
  to: { name: string; email: string };
  subject: string;
  incomingEmail: string;
  questions: string[];
  wordLimit: { min: number; max: number };
  sampleAnswer: string;
  tips: string[];
}

export const EMAIL_TASKS: EmailTask[] = [
  {
    id: 1,
    vprType: 'Тип 4 № 3936',
    from: { name: 'Kieran', email: 'Kieran@friend.uk' },
    to: { name: 'Russian Friend', email: 'Russian Friend@mail.ru' },
    subject: 'Actors',
    incomingEmail: `...I have met Leonardo Di Caprio last week! I love his roles in movies! Who is your favourite actor or actress? What is your favourite film with this person? Would you like to become an actor someday?`,
    questions: [
      'Who is your favourite actor or actress?',
      'What is your favourite film with this person?',
      'Would you like to become an actor someday?',
    ],
    wordLimit: { min: 80, max: 90 },
    sampleAnswer: `Dear Kieran,

Thank you for your last letter! It was great to hear from you.

You asked me about actors. My favourite actress is Emma Watson. She is famous for her role as Hermione Granger in the "Harry Potter" films. My favourite film with her is "Harry Potter and the Philosopher's Stone." I think she is a talented actress and a wonderful person.

As for becoming an actor, I would love to try it! I think it would be exciting to play different characters and work on a film set. But I also want to be a scientist, so I have two dreams!

Write back soon!

Best wishes,
Alex`,
    tips: [
      'Start with "Dear [name]," and end with "Best wishes, [your name]"',
      'Answer all 3 questions from your friend\'s letter',
      'Use linking words: "Also," "Besides," "As for," "What is more"',
      'Check your grammar: Present Simple for facts, Past Simple for past events',
      'Count your words — aim for 80–90 words',
      'Thank your friend for the letter in the opening',
      'Ask a question back to keep the conversation going',
    ],
  },
  {
    id: 2,
    vprType: 'Тип 4 № 3937',
    from: { name: 'Jessica', email: 'Jessica@mail.uk' },
    to: { name: 'Russian Friend', email: 'Russian Friend@mail.ru' },
    subject: 'Holidays',
    incomingEmail: `...I went to Spain with my family last summer. We stayed in a hotel near the beach. The weather was fantastic! Where did you spend your last summer holidays? What did you do there? Would you like to go there again?`,
    questions: [
      'Where did you spend your last summer holidays?',
      'What did you do there?',
      'Would you like to go there again?',
    ],
    wordLimit: { min: 80, max: 90 },
    sampleAnswer: `Dear Jessica,

Thanks for your letter! It was lovely to read about your trip to Spain.

Last summer I went to my grandmother's village in the countryside. The weather was warm and sunny. I swam in the river every day and helped my grandmother in the garden. In the evenings, we had barbecues with our neighbours. It was a wonderful time!

I would definitely like to go there again next summer. I miss the fresh air and the beautiful nature. I hope we can have even more fun!

Write back soon!

Best wishes,
Alex`,
    tips: [
      'Use Past Simple for holiday activities: "I went," "I swam," "I visited"',
      'Use Past Continuous for background: "The sun was shining while we were playing"',
      'Express feelings: "I loved it," "It was amazing," "I enjoyed every minute"',
      'Answer all 3 questions clearly',
      'Use time markers: "last summer," "every day," "in the evenings"',
      'Don\'t forget the greeting and closing format',
    ],
  },
  {
    id: 3,
    vprType: 'Тип 4 № 3938',
    from: { name: 'Tom', email: 'Tom@email.com' },
    to: { name: 'Russian Friend', email: 'Russian Friend@mail.ru' },
    subject: 'School',
    incomingEmail: `...We started a new school term last week. I have got a new timetable — we study nine subjects this year! What is your favourite school subject? Why do you like it? What after-school activities do you do?`,
    questions: [
      'What is your favourite school subject?',
      'Why do you like it?',
      'What after-school activities do you do?',
    ],
    wordLimit: { min: 80, max: 90 },
    sampleAnswer: `Dear Tom,

Thank you for your letter! It was great to hear from you.

My favourite school subject is English. I like it because it is interesting and useful. I enjoy learning new words and reading stories in English. Our teacher makes the lessons fun with games and videos.

After school, I play basketball twice a week. I also go to a drama club on Wednesdays. We are preparing a play for the school show next month. It is very exciting!

What about you? Do you play any sports?

Best wishes,
Alex`,
    tips: [
      'Use Present Simple for school routines: "I study," "I play," "We learn"',
      'Give reasons with "because": "I like it because..."',
      'Use frequency adverbs: "twice a week," "every day," "on Wednesdays"',
      'Answer all 3 questions',
      'Ask a follow-up question at the end',
      'Keep the letter format: greeting → thanks → body → closing',
    ],
  },
];

// ─── Grammar Rules Reference ────────────────────────────────────────────────────

export interface GrammarRule {
  id: string;
  title: string;
  russian: string;
  formula: string;
  negative: string;
  question: string;
  usage: string;
  examples: string[];
  markers: string[];
}

export const TENSES_DATA: GrammarRule[] = [
  {
    id: 'present-simple',
    title: 'Present Simple',
    russian: 'Настоящее простое',
    formula: 'V1 / V-s(es)',
    negative: 'do/does + not + V1',
    question: 'Do/Does + S + V1?',
    usage: 'Regular actions, facts, routine',
    examples: ['I play football every day.', 'She goes to school at 8.', 'Water boils at 100\u00B0C.'],
    markers: ['always', 'usually', 'often', 'sometimes', 'never', 'every day/week/month'],
  },
  {
    id: 'present-continuous',
    title: 'Present Continuous',
    russian: 'Настоящее длительное',
    formula: 'am/is/are + V-ing',
    negative: 'am/is/are + not + V-ing',
    question: 'Am/Is/Are + S + V-ing?',
    usage: 'Action happening right now',
    examples: ['I am reading a book now.', 'She is watching TV at the moment.', 'They are playing in the yard.'],
    markers: ['now', 'at the moment', 'right now', 'look!', 'listen!'],
  },
  {
    id: 'past-simple',
    title: 'Past Simple',
    russian: 'Прошедшее простое',
    formula: 'V2 / V-ed',
    negative: 'did + not + V1',
    question: 'Did + S + V1?',
    usage: 'Completed action in the past',
    examples: ['I visited London last year.', 'She wrote a letter yesterday.', 'We went to the park.'],
    markers: ['yesterday', 'last week/month/year', 'ago', 'in 2020', 'last summer'],
  },
  {
    id: 'future-simple',
    title: 'Future Simple',
    russian: 'Будущее простое',
    formula: 'will + V1',
    negative: 'will + not + V1',
    question: 'Will + S + V1?',
    usage: 'Decision made at the moment, prediction',
    examples: ['I will help you tomorrow.', 'It will rain next week.', 'She will come to the party.'],
    markers: ['tomorrow', 'next week', 'in the future', 'I think', 'probably'],
  },
  {
    id: 'present-perfect',
    title: 'Present Perfect',
    russian: 'Настоящее совершённое',
    formula: 'have/has + V3',
    negative: 'have/has + not + V3',
    question: 'Have/Has + S + V3?',
    usage: 'Result relevant to the present moment',
    examples: ['I have finished my homework.', 'She has already eaten lunch.', 'We have never been to Paris.'],
    markers: ['already', 'yet', 'just', 'ever', 'never', 'recently', 'for', 'since'],
  },
];

export const PASSIVE_VOICE_RULE = {
  title: 'Passive Voice',
  russian: 'Пассивный залог',
  formula: 'am/is/are/was/were + V3',
  examples: [
    'The book is written in English.',
    'The homework was done yesterday.',
    'The room is cleaned every day.',
  ],
  tip: 'Use passive when the ACTION is more important than WHO does it.',
};

export const PRONOUNS_DATA = [
  { subject: 'I', object: 'me', possessive: 'my' },
  { subject: 'You', object: 'you', possessive: 'your' },
  { subject: 'He', object: 'him', possessive: 'his' },
  { subject: 'She', object: 'her', possessive: 'her' },
  { subject: 'It', object: 'it', possessive: 'its' },
  { subject: 'We', object: 'us', possessive: 'our' },
  { subject: 'They', object: 'them', possessive: 'their' },
];

export const IRREGULAR_VERBS = [
  { v1: 'be', v2: 'was/were', v3: 'been' },
  { v1: 'become', v2: 'became', v3: 'become' },
  { v1: 'begin', v2: 'began', v3: 'begun' },
  { v1: 'break', v2: 'broke', v3: 'broken' },
  { v1: 'bring', v2: 'brought', v3: 'brought' },
  { v1: 'build', v2: 'built', v3: 'built' },
  { v1: 'buy', v2: 'bought', v3: 'bought' },
  { v1: 'catch', v2: 'caught', v3: 'caught' },
  { v1: 'choose', v2: 'chose', v3: 'chosen' },
  { v1: 'come', v2: 'came', v3: 'come' },
  { v1: 'do', v2: 'did', v3: 'done' },
  { v1: 'draw', v2: 'drew', v3: 'drawn' },
  { v1: 'drink', v2: 'drank', v3: 'drunk' },
  { v1: 'drive', v2: 'drove', v3: 'driven' },
  { v1: 'eat', v2: 'ate', v3: 'eaten' },
  { v1: 'fall', v2: 'fell', v3: 'fallen' },
  { v1: 'feel', v2: 'felt', v3: 'felt' },
  { v1: 'find', v2: 'found', v3: 'found' },
  { v1: 'fly', v2: 'flew', v3: 'flown' },
  { v1: 'forget', v2: 'forgot', v3: 'forgotten' },
  { v1: 'get', v2: 'got', v3: 'got' },
  { v1: 'give', v2: 'gave', v3: 'given' },
  { v1: 'go', v2: 'went', v3: 'gone' },
  { v1: 'grow', v2: 'grew', v3: 'grown' },
  { v1: 'have', v2: 'had', v3: 'had' },
  { v1: 'hear', v2: 'heard', v3: 'heard' },
  { v1: 'hide', v2: 'hid', v3: 'hidden' },
  { v1: 'hold', v2: 'held', v3: 'held' },
  { v1: 'keep', v2: 'kept', v3: 'kept' },
  { v1: 'know', v2: 'knew', v3: 'known' },
  { v1: 'leave', v2: 'left', v3: 'left' },
  { v1: 'lend', v2: 'lent', v3: 'lent' },
  { v1: 'lose', v2: 'lost', v3: 'lost' },
  { v1: 'make', v2: 'made', v3: 'made' },
  { v1: 'meet', v2: 'met', v3: 'met' },
  { v1: 'read', v2: 'read', v3: 'read' },
  { v1: 'ride', v2: 'rode', v3: 'ridden' },
  { v1: 'run', v2: 'ran', v3: 'run' },
  { v1: 'say', v2: 'said', v3: 'said' },
  { v1: 'see', v2: 'saw', v3: 'seen' },
  { v1: 'sell', v2: 'sold', v3: 'sold' },
  { v1: 'send', v2: 'sent', v3: 'sent' },
  { v1: 'sit', v2: 'sat', v3: 'sat' },
  { v1: 'sleep', v2: 'slept', v3: 'slept' },
  { v1: 'speak', v2: 'spoke', v3: 'spoken' },
  { v1: 'spend', v2: 'spent', v3: 'spent' },
  { v1: 'swim', v2: 'swam', v3: 'swum' },
  { v1: 'take', v2: 'took', v3: 'taken' },
  { v1: 'teach', v2: 'taught', v3: 'taught' },
  { v1: 'tell', v2: 'told', v3: 'told' },
  { v1: 'think', v2: 'thought', v3: 'thought' },
  { v1: 'understand', v2: 'understood', v3: 'understood' },
  { v1: 'wake', v2: 'woke', v3: 'woken' },
  { v1: 'wear', v2: 'wore', v3: 'worn' },
  { v1: 'win', v2: 'won', v3: 'won' },
  { v1: 'write', v2: 'wrote', v3: 'written' },
];
