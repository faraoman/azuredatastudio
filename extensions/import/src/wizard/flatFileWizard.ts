/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { FlatFileProvider } from '../services/contracts';
import { ImportDataModel } from './api/models';
import { ImportPage } from './api/importPage';
// pages
import { FileConfigPage } from './pages/fileConfigPage';
import { ProsePreviewPage } from './pages/prosePreviewPage';
import { ModifyColumnsPage } from './pages/modifyColumnsPage';
import { SummaryPage } from './pages/summaryPage';
import { ApiWrapper } from '../common/apiWrapper';
import * as constants from '../common/constants';

export class FlatFileWizard {
	private readonly provider: FlatFileProvider;
	private wizard: azdata.window.Wizard;

	private importAnotherFileButton: azdata.window.Button;

	constructor(
		provider: FlatFileProvider,
		private _apiWrapper: ApiWrapper
	) {
		this.provider = provider;
	}

	public async start(p: any, ...args: any[]) {
		let model = {} as ImportDataModel;

		let profile = p?.connectionProfile as azdata.IConnectionProfile;
		if (profile) {
			model.serverId = profile.id;
			model.database = profile.databaseName;
		}

		let pages: Map<number, ImportPage> = new Map<number, ImportPage>();

		let currentConnection = await this._apiWrapper.getCurrentConnection();

		let connectionId: string;

		if (!currentConnection) {
			connectionId = (await this._apiWrapper.openConnectionDialog(constants.supportedProviders)).connectionId;
			if (!connectionId) {
				this._apiWrapper.showErrorMessage(constants.needConnectionText);
				return;
			}
		} else {
			if (currentConnection.providerId !== 'MSSQL') {
				this._apiWrapper.showErrorMessage(constants.needSqlConnectionText);
				return;
			}
			connectionId = currentConnection.connectionId;
		}


		model.serverId = connectionId;

		this.wizard = this._apiWrapper.createWizard(constants.wizardNameText);
		let page1 = this._apiWrapper.createWizardPage(constants.page1NameText);
		let page2 = this._apiWrapper.createWizardPage(constants.page2NameText);
		let page3 = this._apiWrapper.createWizardPage(constants.page3NameText);
		let page4 = this._apiWrapper.createWizardPage(constants.page4NameText);

		let fileConfigPage: FileConfigPage;

		page1.registerContent(async (view) => {
			fileConfigPage = new FileConfigPage(this, page1, model, view, this.provider, this._apiWrapper);
			pages.set(0, fileConfigPage);
			await fileConfigPage.start().then(() => {
				fileConfigPage.setupNavigationValidator();
				fileConfigPage.onPageEnter();
			});
		});

		let prosePreviewPage: ProsePreviewPage;
		page2.registerContent(async (view) => {
			prosePreviewPage = new ProsePreviewPage(this, page2, model, view, this.provider, this._apiWrapper);
			pages.set(1, prosePreviewPage);
			await prosePreviewPage.start();
		});

		let modifyColumnsPage: ModifyColumnsPage;
		page3.registerContent(async (view) => {
			modifyColumnsPage = new ModifyColumnsPage(this, page3, model, view, this.provider, this._apiWrapper);
			pages.set(2, modifyColumnsPage);
			await modifyColumnsPage.start();
		});

		let summaryPage: SummaryPage;

		page4.registerContent(async (view) => {
			summaryPage = new SummaryPage(this, page4, model, view, this.provider, this._apiWrapper);
			pages.set(3, summaryPage);
			await summaryPage.start();
		});


		this.importAnotherFileButton = this._apiWrapper.createButton(constants.importNewFileText);
		this.importAnotherFileButton.onClick(() => {
			//TODO replace this with proper cleanup for all the pages
			this.wizard.close();
			pages.forEach((page) => page.cleanup());
			this.wizard.open();
		});

		this.importAnotherFileButton.hidden = true;
		this.wizard.customButtons = [this.importAnotherFileButton];
		this.wizard.onPageChanged(async (event) => {
			let newPageIdx = event.newPage;
			let lastPageIdx = event.lastPage;
			let newPage = pages.get(newPageIdx);
			let lastPage = pages.get(lastPageIdx);
			if (lastPage) {
				await lastPage.onPageLeave();
			}
			if (newPage) {
				newPage.setupNavigationValidator();
				await newPage.onPageEnter();
			}
		});

		//not needed for this wizard
		this.wizard.generateScriptButton.hidden = true;

		this.wizard.pages = [page1, page2, page3, page4];

		this.wizard.open();
	}

	public setImportAnotherFileVisibility(visibility: boolean) {
		this.importAnotherFileButton.hidden = !visibility;
	}

	public registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}

	public changeNextButtonLabel(label: string) {
		this.wizard.nextButton.label = label;
	}


}
