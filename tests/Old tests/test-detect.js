import fetch from "node-fetch";

const res = await fetch("http://localhost:3000/api/detect-lang", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Hej hur mår du?" })
});

const data = await res.json();
console.log(data);
