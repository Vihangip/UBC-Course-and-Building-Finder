import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError
} from "./IInsightFacade";
import * as fs from "fs-extra";

import {InsightDatasetExpanded, SectionFacade} from "./SectionFacade";
import JSZip from "jszip";


/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	// InsightDataset[] variable stores added datasets
	private datasets: InsightDatasetExpanded[];

	// Set up InsightDatasetExpanded[] variable
	constructor() {
		this.datasets = [];
		console.log("InsightFacadeImpl::init()");
	}

	private fileStringToSectionArray(fileString: string) {
		if (fileString.trim().length === 0) {
			return [];
		}
		let sections = [];
		let jsonified = JSON.parse(fileString);
		for (let section of jsonified.result) {
			// todo check if any of these are undefined
			let newSection: SectionFacade = {
				audit: section.Audit,
				avg: section.Avg,
				dept: section.Subject,
				fail: section.Fail,
				id: section.Course,
				instructor: section.Professor,
				pass: section.Pass,
				title: section.Title,
				uuid: section.id,
				year: section.Year
			};
			sections.push(newSection);
			// todo file persistence
			// fs.outputJson("/data/" + id + "/" + section.id + ".json", newSection)
			//	.catch((err) => {
			//		console.error(err);
			//	});
		}
		return sections;
	}

	private sectionArraysToDataset(sectionArrays: SectionFacade[][], id: string, kind: InsightDatasetKind) {
		let sections = sectionArrays.flat();

		let newDataset: InsightDatasetExpanded = {
			id: id,
			kind: kind,
			numRows: sections.length,
			sections: sections
		};

		return newDataset;
	}

	/*
	The zip file seems to be organized into:
	courses
		CPSC110
			Section 101
			Section 102
			...
		CPSC210
			Section 101
			Section 102
			...
		...
	so here I am iterating over individual files
	and then within those files iterating over sections.
	 */
	private async handleJSON(id: string, kind: InsightDatasetKind, z: JSZip) {
		if (z !== null) {
			let promises: Array<Promise<SectionFacade[]>> = [];

			let filteredFiles = z.filter(function (relativePath, file){
				return relativePath.startsWith("courses/");
			});

			if (filteredFiles.length === 0) {
				return Promise.reject(new InsightError("Invalid content: not within a courses folder"));
			}

			for (let file of filteredFiles) {
				promises.push(
					new Promise((resolve, reject) => {
						file.async("string")
							.then((fileString) => {
								let sections = this.fileStringToSectionArray(fileString);
								resolve(sections);
							});
					}));
			}

			return new Promise<void>((resolve, reject) => {
				Promise.all(promises).then((sectionArrays) => {
					let newDataset = this.sectionArraysToDataset(sectionArrays, id, kind);

					for (let dataset of this.datasets) {
						if (dataset.id === id) {
							reject(new InsightError("Invalid id: id already exists"));
						}
					}
					this.datasets.push(newDataset);
					resolve();
				});
			});
		}
	}

	private getDatasetIDs() {
		let ids = [];
		for (let dataset of this.datasets) {
			ids.push(dataset.id);
		}
		return ids;
	}

	public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		// verify that id is ok
		if (id.trim().length === 0 || id.includes("_")) {
			return Promise.reject(new InsightError("Invalid id: only whitespace or contains underscore"));
		}

		// verify that content is a string with length > 0
		if (content.trim().length === 0) {
			return Promise.reject(new InsightError("Invalid content: no content"));
		}

		// checking disk
		return new Promise<string[]>((resolve, reject) => {
			fs.pathExists("./data/" + id)
				.then((exists) => {
					if (exists) {
						reject(new InsightError("Invalid id: id already exists"));
					}
					// unzip, parse content
					let zip = new JSZip();

					zip.loadAsync(content, {base64: true})
						.then((z) => {
							this.handleJSON(id, kind, z)
								.then(() => {
									resolve(this.getDatasetIDs());
								})
								.catch((err) => {
									reject(err);
								});
						});
				});
		});
	}

	public removeDataset(id: string): Promise<string> {
		return Promise.reject("Not implemented.");
	}

	public performQuery(query: unknown): Promise<InsightResult[]> {
		return Promise.reject("Not implemented.");
	}

	public listDatasets(): Promise<InsightDataset[]> {
		return Promise.reject("Not implemented.");
	}

}
