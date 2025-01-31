/*interface Answer {
  text: string
  result: string
}

interface Question {
  id: number
  text: string
  answers: Answer[]
  theme: string
}*/

export const questions: Question[] = [
  {
    id: 1,
    text: "КАКОЙ_ЗВУК_ДВИГАТЕЛЯ_АКТИВИРУЕТ_ТВОЮ_СИСТЕМУ?",
    answers: [
      { text: "ТИХИЙ_ГУЛ_ЭЛЕКТРОМОТОРА", result: "tesla" },
      { text: "РЕВ_V12_КАК_В_КВАНТОВОМ_УСКОРИТЕЛЕ", result: "ferrari" },
      { text: "БАСИСТЫЙ_РОКОТ_НЕОАМЕРИКАНСКОГО_V8", result: "porsche" },
    ],
    theme: "sound",
  },
  {
    id: 2,
    text: "ВЫБЕРИ_ИДЕАЛЬНЫЙ_МАРШРУТ_ДЛЯ_ТЕСТДРАЙВА:",
    answers: [
      { text: "ВИРТУАЛЬНАЯ_ТРАССА_НЮРБУРГРИНГ", result: "mclaren" },
      { text: "НЕОНОВОЕ_ШОССЕ_КИБЕРКАЛИФОРНИИ", result: "tesla" },
      { text: "КВАНТОВЫЙ_ГОРНЫЙ_СЕРПАНТИН", result: "lamborghini" },
    ],
    theme: "road",
  },
  {
    id: 3,
    text: "ЧТО_ВАЖНЕЕ_В_КИБЕР-САЛОНЕ?",
    answers: [
      { text: "ГОЛОГРАФИЧЕСКИЕ_ЭКРАНЫ_И_НЕЙРО-ИИ", result: "tesla" },
      { text: "ЗАПАХ_СИНТЕТИЧЕСКОЙ_КОЖИ_БУДУЩЕГО", result: "ferrari" },
      { text: "НАНО-УГЛЕРОДНОЕ_ВОЛОКНО_ПОВСЮДУ", result: "porsche" },
    ],
    theme: "interior",
  },
]

