## 🎥 Demo

See Corpus Explorer in action:

[▶ Watch the Corpus Explorer demo](demo/corpus-explorer-demo.mp4)

A web-based research environment for **corpus linguistics, linguistic annotation, and AI-assisted language analysis**.

Corpus Explorer is an ongoing research software project designed to make corpus exploration and linguistic annotation more interactive and accessible. It combines a web-based interface with a Python backend, corpus-processing tools, structured annotation workflows, and experimental local AI functionality.

The project grew out of my work in corpus linguistics and my interest in developing computational tools that respond directly to the needs of language researchers.

## Key Features

### Corpus Exploration

- Search and explore corpus data through a web interface
- Retrieve linguistic examples and contextual information
- Process corpus data through a Python backend
- Present query results dynamically in the browser

### Linguistic Annotation

The application includes workflows for manually reviewing and annotating linguistic phenomena.

Current development includes tools for:

- reviewing corpus instances
- classifying linguistic constructions
- saving annotation decisions
- organising reviewed and unreviewed examples
- exporting annotation results for subsequent analysis

One current use case focuses on the analysis of **English genitive constructions**, including the identification and annotation of *of*-genitives and related structures.

## AI-Assisted Analysis

Corpus Explorer is also being developed as an environment for experimenting with **local AI/LLM-assisted corpus analysis**.

The goal is to investigate how local language models can support tasks such as:

- linguistic classification
- corpus annotation
- identification of candidate constructions
- assisted analysis of large numbers of corpus examples

A key design principle is to keep the researcher involved in the annotation and validation process rather than treating model output as automatically correct.

## Architecture

The application separates the user interface, backend processing, corpus data, and AI components.

```text
Web Interface
     │
     ▼
Frontend
     │
     │ API requests
     ▼
Python / FastAPI Backend
     │
     ├── Corpus search and processing
     ├── Annotation and review
     ├── Structured data handling
     └── AI/LLM integration
              │
              ▼
          Local Model
```

## Technologies

The project currently uses technologies including:

- **Python**
- **FastAPI**
- **JavaScript**
- **React**
- **Vite**
- **REST APIs**
- **JSON**
- **SQLite**
- **PHP**
- Local language-model integration

The application is under active development, and its architecture and functionality continue to evolve alongside my corpus-linguistic research.

## Research Context

Corpus Explorer is primarily a **research software project** rather than a general-purpose corpus platform.

It has been developed to explore how web technologies, corpus-linguistic methods, and AI-assisted analysis can be combined within a single research workflow.

The project is particularly concerned with maintaining a connection between computational analysis and researcher judgement. AI-assisted functionality is therefore designed to complement manual corpus analysis and annotation rather than replace it.

## Data

Corpus datasets used in my research are **not included in this repository** because of licensing, copyright, and research-data restrictions.

The repository contains the application source code only.

Where necessary, demonstration data can be used to test application functionality without distributing restricted corpus material.

## Current Development

Current areas of development include:

- expanding linguistic annotation workflows
- genitive construction analysis
- improving corpus search and filtering
- AI-assisted annotation
- local language-model experimentation
- improving the research interface and visualisation of corpus results

## About

This project was developed by **Kimia Askarian** as part of my work at the intersection of **corpus linguistics, computational language analysis, and research software development**.
